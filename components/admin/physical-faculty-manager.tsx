"use client";

import React, { useState, useMemo } from "react";
import type { PhysicalFaculty } from "@/lib/types";
import { persianSearch } from "@/lib/search/persian-search";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MapPin,
  Camera,
  Upload,
  RefreshCw,
  Download,
  Sparkles,
  ExternalLink,
  Navigation,
  Globe,
  Compass,
  AlertTriangle,
  Building,
} from "lucide-react";
import { PhysicalFacultyImportDialog } from "./physical-faculty-import-dialog";
import { useAdminStore } from "@/lib/stores/admin-store";

interface PhysicalFacultyManagerProps {
  physicalFaculties: PhysicalFaculty[];
  onDataChanged: () => Promise<void>;
}

function parseCoordinateInput(input: string): { lat: number; lon: number } | null {
  if (!input || !input.trim()) return null;
  const str = input.trim();

  // Format 1: "35.7027, 51.3912" or "35.7027 51.3912"
  const rawPairMatch = str.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (rawPairMatch) {
    const lat = parseFloat(rawPairMatch[1]);
    const lon = parseFloat(rawPairMatch[2]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  // Format 2: Google Maps / Neshan URL e.g. @35.7027,51.3912
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
  }

  // Format 3: Query param e.g. ?q=35.7027,51.3912
  const qMatch = str.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };
  }

  // Format 4: Balad URL latitude=...&longitude=...
  const latLonMatch = str.match(/latitude=(-?\d+\.\d+)&longitude=(-?\d+\.\d+)/);
  if (latLonMatch) {
    return { lat: parseFloat(latLonMatch[1]), lon: parseFloat(latLonMatch[2]) };
  }

  return null;
}

export function PhysicalFacultyManager({
  physicalFaculties = [],
  onDataChanged,
}: PhysicalFacultyManagerProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<PhysicalFaculty | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    code: "",
    imageUrl: "",
    latitude: "",
    longitude: "",
    address: "",
    description: "",
  });

  // Coordinate parser helper state
  const [pasteLocationInput, setPasteLocationInput] = useState("");
  const [pasteHelperSuccess, setPasteHelperSuccess] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<PhysicalFaculty | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenCreateModal = () => {
    setEditingFaculty(null);
    setFormError(null);
    setPasteLocationInput("");
    setPasteHelperSuccess(false);
    setForm({
      name: "",
      code: "",
      imageUrl: "",
      latitude: "",
      longitude: "",
      address: "",
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: PhysicalFaculty) => {
    setEditingFaculty(item);
    setFormError(null);
    setPasteLocationInput("");
    setPasteHelperSuccess(false);
    setForm({
      name: item.name || "",
      code: item.code || "",
      imageUrl: item.imageUrl || "",
      latitude: item.latitude !== null && item.latitude !== undefined ? String(item.latitude) : "",
      longitude: item.longitude !== null && item.longitude !== undefined ? String(item.longitude) : "",
      address: item.address || "",
      description: item.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSmartParseLocation = () => {
    const res = parseCoordinateInput(pasteLocationInput);
    if (res) {
      setForm((prev) => ({
        ...prev,
        latitude: String(res.lat),
        longitude: String(res.lon),
      }));
      setPasteHelperSuccess(true);
      setTimeout(() => setPasteHelperSuccess(false), 3000);
    } else {
      alert("مختصات از ورودی استخراج نشد. لطفاً لینک کامل گوگل‌مپ/نشان یا جفت عدد (مانند 35.7027, 51.3912) را وارد کنید.");
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await postJson("/api/upload", formData);

      if (res.success && res.url) {
        setForm((prev) => ({ ...prev, imageUrl: res.url }));
        setFormError(null);
      } else {
        setFormError(res.message || "خطا در آپلود تصویر");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setFormError("خطا در برقراری ارتباط با سرور آپلود");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("نام دانشکده فیزیکی الزامی است.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const lat = form.latitude.trim() ? parseFloat(form.latitude) : null;
      const lon = form.longitude.trim() ? parseFloat(form.longitude) : null;

      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        latitude: lat !== null && !isNaN(lat) ? lat : null,
        longitude: lon !== null && !isNaN(lon) ? lon : null,
        address: form.address.trim() || undefined,
        description: form.description.trim() || undefined,
      };

      if (editingFaculty) {
        const res = await putJson(`/api/physical-faculties/${editingFaculty.id}`, payload);
        if (res.success) {
          setIsModalOpen(false);
          if (res.data) {
            const { physicalFaculties, setPhysicalFaculties } = useAdminStore.getState();
            setPhysicalFaculties(
              physicalFaculties.map((f) => (f.id === res.data.id ? res.data : f))
            );
          }
          await onDataChanged();
        } else {
          setFormError(res.message || "خطا در ویرایش دانشکده");
        }
      } else {
        const res = await postJson("/api/physical-faculties", payload);
        if (res.success) {
          setIsModalOpen(false);
          if (res.data) {
            const { physicalFaculties, setPhysicalFaculties } = useAdminStore.getState();
            setPhysicalFaculties([res.data, ...physicalFaculties]);
          }
          await onDataChanged();
        } else {
          setFormError(res.message || "خطا در ایجاد دانشکده");
        }
      }
    } catch (err: any) {
      setFormError(err.message || "خطا در ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteJson(`/api/physical-faculties/${deleteTarget.id}`);
      if (res.success) {
        const { physicalFaculties, setPhysicalFaculties } = useAdminStore.getState();
        setPhysicalFaculties(physicalFaculties.filter((f) => f.id !== deleteTarget.id));
        setDeleteTarget(null);
        await onDataChanged();
      } else {
        alert(res.message || "خطا در حذف دانشکده");
      }
    } catch (err: any) {
      alert("خطا در برقراری ارتباط با سرور: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportJson = async () => {
    try {
      setIsExporting(true);
      const res = await fetchJson("/api/physical-faculties/export");
      if (res.success && res.data) {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(res.data, null, 2)
        )}`;
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", jsonString);
        downloadAnchor.setAttribute("download", `physical_faculties_export.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("خطا در خروجی گرفتن از فایل JSON");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredFaculties = useMemo(() => {
    const activeList = physicalFaculties.filter((f) => !f.deletedAt);
    if (!search.trim()) return activeList;
    return persianSearch(activeList, search);
  }, [physicalFaculties, search]);

  const hasCoordinates = (f: PhysicalFaculty) =>
    f.latitude !== null &&
    f.latitude !== undefined &&
    f.longitude !== null &&
    f.longitude !== undefined;

  const currentFormLat = parseFloat(form.latitude);
  const currentFormLon = parseFloat(form.longitude);
  const formHasValidCoordinates =
    !isNaN(currentFormLat) &&
    !isNaN(currentFormLon) &&
    Math.abs(currentFormLat) <= 90 &&
    Math.abs(currentFormLon) <= 180;

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    مدیریت دانشکده‌های فیزیکی و پردیس‌ها
                  </CardTitle>
                  <CardDescription className="text-xs">
                    تعریف ساختمان‌ها، پردیس‌ها، مختصات مکانی نقشه و تصاویر برای راهنمایی دانشجویان
                  </CardDescription>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={isExporting || physicalFaculties.length === 0}
                className="gap-1.5 shadow-2xs"
              >
                <Download className={`h-3.5 w-3.5 ${isExporting ? "animate-bounce" : ""}`} />
                <span>خروجی JSON</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(true)}
                className="gap-1.5 shadow-2xs font-semibold"
              >
                <Upload className="h-3.5 w-3.5 text-primary" />
                <span>ورود JSON</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleOpenCreateModal}
                className="gap-1.5 font-bold shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>افزودن دانشکده فیزیکی</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Search bar & Counts */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="جستجو بر اساس نام، کد یا آدرس..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-8 pl-3"
              />
            </div>

            <Badge variant="secondary" className="text-xs font-mono h-7 px-2.5 w-fit">
              {filteredFaculties.length} دانشکده فیزیکی ثبت‌شده
            </Badge>
          </div>

          {/* Cards Grid */}
          {filteredFaculties.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground space-y-3 rounded-2xl border border-dashed border-border/70">
              <Compass className="h-10 w-10 mx-auto opacity-30 text-primary" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">هیچ دانشکده فیزیکی یافت نشد.</p>
                <p className="text-[11px]">
                  می‌توانید با دکمه «افزودن دانشکده فیزیکی» یا «ورود JSON» اولین مورد را ثبت کنید.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFaculties.map((faculty) => (
                <div
                  key={faculty.id}
                  className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Cover image / photo */}
                    <div className="relative h-36 w-full bg-muted/40 overflow-hidden border-b">
                      {faculty.imageUrl ? (
                        <img
                          src={faculty.imageUrl}
                          alt={faculty.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-1.5">
                          <Building className="h-8 w-8" />
                          <span className="text-[11px]">بدون تصویر</span>
                        </div>
                      )}

                      {/* Code Badge */}
                      {faculty.code && (
                        <div className="absolute top-2.5 left-2.5">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono shadow-xs backdrop-blur bg-background/85"
                          >
                            {faculty.code}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Body Info */}
                    <div className="p-4 space-y-2.5">
                      <div>
                        <h3 className="font-bold text-sm text-foreground line-clamp-1">
                          {faculty.name}
                        </h3>
                        {faculty.address ? (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 flex items-start gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                            <span>{faculty.address}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 mt-1 italic">
                            آدرس متنی ثبت نشده است
                          </p>
                        )}
                      </div>

                      {/* Coordinates Chip */}
                      {hasCoordinates(faculty) ? (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono bg-primary/5 text-primary border-primary/20 gap-1"
                          >
                            <Navigation className="h-3 w-3" />
                            <span>
                              {faculty.latitude?.toFixed(4)}, {faculty.longitude?.toFixed(4)}
                            </span>
                          </Badge>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${faculty.latitude},${faculty.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                          >
                            <span>نقشه</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          بدون مختصات نقشه
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3 border-t bg-muted/10 flex items-center justify-between">
                    <a
                      href={`/physical-faculties/${faculty.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>مشاهده صفحه عمومی</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditModal(faculty)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="ویرایش مشخصات"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(faculty)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="حذف دانشکده"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base font-bold">
              {editingFaculty ? "ویرایش مشخصات دانشکده فیزیکی" : "افزودن دانشکده فیزیکی جدید"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ثبت نام پردیس، مشخصات تصویر، نشانی و موقعیت دقیق روی نقشه
            </DialogDescription>
          </DialogHeader>

          <form id="physical-faculty-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-1 h-full space-y-4">
            {formError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Row 1: Name and Code */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">
                  نام دانشکده یا پردیس <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="مثال: دانشکده مهندسی برق و کامپیوتر (پردیس ۲)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className=""
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  کد شناسایی <span className="text-muted-foreground text-[10px]">(اختیاری)</span>
                </Label>
                <Input
                  placeholder="مثال: PFAC-ECE"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Row 2: Image URL & Upload */}
            <div className="space-y-2 rounded-xl border p-3.5 bg-muted/20">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>تصویر نما / پردیس دانشکده</span>
                <span className="text-[10px] text-muted-foreground">اختیاری</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="https://... یا آپلود فایل تصویر"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="text-left font-mono"
                  dir="ltr"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImage}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0 font-semibold"
                    disabled={uploadingImage}
                    asChild
                  >
                    <span>
                      {uploadingImage ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                      <span>{uploadingImage ? "در حال آپلود..." : "آپلود"}</span>
                    </span>
                  </Button>
                </label>
              </div>

              {form.imageUrl && (
                <div className="relative mt-2 h-28 w-full rounded-lg overflow-hidden border bg-background">
                  <img
                    src={form.imageUrl}
                    alt="پیش‌نمایش تصویر"
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                  />
                </div>
              )}
            </div>

            {/* Row 3: Geo Coordinates & Smart Paste */}
            <div className="space-y-3 rounded-xl border p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>موقعیت جغرافیایی و مختصات نقشه</span>
                </Label>
                <span className="text-[10px] text-muted-foreground">اختیاری</span>
              </div>

              {/* Helper to paste Google Maps / Neshan link or coordinates */}
              <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5">
                <span className="text-[11px] text-muted-foreground font-medium block">
                  💡 استخراج خودکار مختصات از لینک یا متن:
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="لینک گوگل مپس، نشان یا مختصات (مانند 35.7027, 51.3912)..."
                    value={pasteLocationInput}
                    onChange={(e) => setPasteLocationInput(e.target.value)}
                    className="text-left font-mono bg-background"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleSmartParseLocation}
                    disabled={!pasteLocationInput.trim()}
                    className="shrink-0"
                  >
                    <span>استخراج</span>
                  </Button>
                </div>
                {pasteHelperSuccess && (
                  <span className="text-[11px] text-emerald-600 font-bold block animate-in fade-in">
                    ✔ مختصات با موفقیت استخراج و در فرم درج شد.
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">عرض جغرافیایی (Latitude)</Label>
                  <Input
                    placeholder="مثال: 35.7027"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    className="h-8 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">طول جغرافیایی (Longitude)</Label>
                  <Input
                    placeholder="مثال: 51.3912"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    className="h-8 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Mini Map Preview */}
              {formHasValidCoordinates && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    پیش‌نمایش موقعیت روی نقشه:
                  </span>
                  <div className="h-36 w-full rounded-lg overflow-hidden border bg-background">
                    <iframe
                      title="پیش‌نمایش نقشه"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentFormLon - 0.005}%2C${currentFormLat - 0.003}%2C${currentFormLon + 0.005}%2C${currentFormLat + 0.003}&layer=mapnik&marker=${currentFormLat}%2C${currentFormLon}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Row 4: Text Address */}
            <div className="space-y-1.5 overflow-visible">
              <Label className="text-xs font-semibold">
                آدرس متنی و مسیر دسترسی <span className="text-muted-foreground text-[10px]">(اختیاری)</span>
              </Label>
              <Textarea
                placeholder="مثال: تهران، خیابان کارگر شمالی، بالاتر از جلال آل احمد، پردیس ۲ دانشکده‌های فنی..."
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* Row 5: Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                توضیحات و مشخصات پردیس <span className="text-muted-foreground text-[10px]">(اختیاری)</span>
              </Label>
              <Textarea
                placeholder="امکانات، آزمایشگاه‌ها، ورودی‌ها یا گروه‌های مستقر..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </form>

          <DialogFooter className="pt-2 border-t flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              انصراف
            </Button>
            <Button
              type="submit"
              form="physical-faculty-form"
              size="sm"
              disabled={isSubmitting}
              className="text-xs gap-1.5 font-bold shadow-xs"
            >
              {isSubmitting && (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>{editingFaculty ? "ذخیره تغییرات" : "ایجاد دانشکده فیزیکی"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4.5 w-4.5" />
              <span>تأیید انتقال به سطل زباله</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              آیا از حذف موقت دانشکده فیزیکی <strong>«{deleteTarget?.name}»</strong> اطمینان دارید؟
              این آیتم به سطل بازیافت منتقل شده و در هر زمان قابل بازگردانی خواهد بود.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-between pt-3 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs font-bold gap-1"
            >
              {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>تأیید و حذف</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON Import Dialog */}
      <PhysicalFacultyImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={async () => {
          await onDataChanged();
        }}
      />
    </div>
  );
}
