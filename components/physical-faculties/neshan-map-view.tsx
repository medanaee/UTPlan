"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "@neshan-maps-platform/maplibre-sdk";
import "@neshan-maps-platform/maplibre-sdk/style.css";
import { useTheme } from "@/components/theme-provider";
import type { PhysicalFaculty } from "@/lib/types";

const NESHAN_API_KEY = "web.107c7245f6ce48ffa96285880517f0bd";
const NESHAN_LIGHT_STYLE = "https://static.neshan.org/sdk/maplibre/styles/light.json";
const NESHAN_DARK_STYLE = "https://static.neshan.org/sdk/maplibre/styles/dark.json";

// Default center: Tehran University area (Amirabad / Central Campus)
const DEFAULT_CENTER: [number, number] = [51.3885, 35.7245];
const DEFAULT_ZOOM = 12.5;

interface NeshanMapViewProps {
  faculties: PhysicalFaculty[];
  selectedFaculty: PhysicalFaculty | null;
  onSelectFaculty: (faculty: PhysicalFaculty) => void;
  flyToCoords?: [number, number] | null;
}

export function NeshanMapView({
  faculties,
  selectedFaculty,
  onSelectFaculty,
  flyToCoords,
}: NeshanMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ id: string; marker: maplibregl.Marker; el: HTMLElement }[]>([]);
  const { resolvedTheme } = useTheme();

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleUrl = resolvedTheme === "dark" ? NESHAN_DARK_STYLE : NESHAN_LIGHT_STYLE;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      apiKey: NESHAN_API_KEY,
      attributionControl: true,
      logoPosition: "bottom-left",
    });

    // Add navigation controls (zoom, compass)
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      "bottom-left"
    );

    // Add fullscreen control
    map.addControl(new maplibregl.FullscreenControl(), "bottom-left");

    mapInstanceRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // Update map style when theme changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const targetStyle = resolvedTheme === "dark" ? NESHAN_DARK_STYLE : NESHAN_LIGHT_STYLE;
    try {
      map.setStyle(targetStyle);
    } catch (err) {
      console.error("Failed to update Neshan map style:", err);
    }
  }, [resolvedTheme]);

  // Handle markers rendering
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];

    // Filter faculties with valid coordinates
    const mappableFaculties = faculties.filter(
      (f) =>
        f.latitude !== null &&
        f.latitude !== undefined &&
        f.longitude !== null &&
        f.longitude !== undefined
    );

    mappableFaculties.forEach((faculty) => {
      const isSelected = selectedFaculty?.id === faculty.id;

      // Marker container
      const markerEl = document.createElement("div");
      markerEl.className = `neshan-faculty-marker group relative cursor-pointer select-none`;
      markerEl.setAttribute("data-faculty-id", faculty.id);

      // Inner pin HTML
      markerEl.innerHTML = `
        <div class="relative flex flex-col items-center transition-transform duration-300 ${
          isSelected ? "scale-125 -translate-y-3 z-30" : "hover:scale-115 hover:-translate-y-1.5 z-10"
        }">
          <!-- Circular Head -->
          <div class="w-12 h-12 rounded-full border-2 ${
            isSelected
              ? "border-primary ring-4 ring-primary/40 shadow-xl shadow-primary/30"
              : "border-white dark:border-zinc-800 ring-2 ring-primary/70 shadow-lg"
          } overflow-hidden bg-background flex items-center justify-center transition-all duration-300">
            ${
              faculty.imageUrl
                ? `<img src="${faculty.imageUrl}" alt="${faculty.name}" class="w-full h-full object-cover pointer-events-none" />`
                : `<div class="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs tracking-tighter">UT</div>`
            }
          </div>
          <!-- Pointer Tip (triangle pointing down) -->
          <div class="w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] ${
            isSelected ? "border-t-primary" : "border-t-white dark:border-t-zinc-800"
          } -mt-[1px] drop-shadow-md"></div>
          <!-- Pulse Dot -->
          <div class="w-2 h-2 rounded-full ${
            isSelected ? "bg-primary animate-ping" : "bg-primary/80"
          } mt-0.5 shadow-sm"></div>
        </div>
      `;

      // Hover Tooltip / Popup
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: [0, -56],
        className: "neshan-faculty-popup",
      });

      const popupHtml = `
        <div class="px-3 py-2 font-sans text-xs font-bold text-foreground bg-card/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-border shadow-xl flex items-center gap-2" dir="rtl">
          <span class="w-2 h-2 rounded-full bg-primary inline-block shrink-0 animate-pulse"></span>
          <div class="flex flex-col gap-0.5">
            <span class="truncate max-w-[200px] leading-snug">${faculty.name}</span>
            ${
              faculty.code
                ? `<span class="text-[10px] font-mono font-normal text-muted-foreground">${faculty.code}</span>`
                : ""
            }
          </div>
        </div>
      `;

      markerEl.addEventListener("mouseenter", () => {
        popup
          .setLngLat([faculty.longitude!, faculty.latitude!])
          .setHTML(popupHtml)
          .addTo(map);
      });

      markerEl.addEventListener("mouseleave", () => {
        popup.remove();
      });

      markerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectFaculty(faculty);
        map.flyTo({
          center: [faculty.longitude!, faculty.latitude!],
          zoom: 15.5,
          duration: 1200,
          essential: true,
        });
      });

      const marker = new maplibregl.Marker({
        element: markerEl,
        anchor: "bottom",
      })
        .setLngLat([faculty.longitude!, faculty.latitude!])
        .addTo(map);

      markersRef.current.push({ id: faculty.id, marker, el: markerEl });
    });
  }, [faculties, selectedFaculty, onSelectFaculty]);

  // Handle programmatic flyTo (e.g. from search selection or preset button)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !flyToCoords) return;

    map.flyTo({
      center: flyToCoords,
      zoom: 15.5,
      duration: 1200,
      essential: true,
    });
  }, [flyToCoords]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />
      <style jsx global>{`
        .neshan-faculty-popup .maplibregl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .neshan-faculty-popup .maplibregl-popup-tip {
          border-top-color: var(--border) !important;
        }
      `}</style>
    </div>
  );
}
