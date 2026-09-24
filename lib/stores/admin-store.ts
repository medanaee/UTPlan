import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchJson } from "@/lib/api-client";
import type {
  User,
  Faculty,
  Major,
  Track,
  Course,
  Professor,
  Category,
  VisualCategory,
  RuleCategory,
  TrackCourseAssignment,
  PhysicalFaculty,
} from "@/lib/types";

export type AdminTab =
  | "structure"
  | "physical-faculties"
  | "courses"
  | "offerings"
  | "events"
  | "professors"
  | "categories"
  | "approved-charts"
  | "rules"
  | "users"
  | "backup"
  | "trash"
  | "audit";

export interface LoadedPanels {
  structure: boolean;
  physicalFaculties: boolean;
  courses: boolean;
  professors: boolean;
  offerings: boolean;
  events: boolean;
  categories: Record<string, boolean>; // trackId -> boolean
  approvedCharts: boolean;
}

interface AdminState {
  user: User | null;
  faculties: Faculty[];
  physicalFaculties: PhysicalFaculty[];
  majors: Major[];
  tracks: Track[];
  courses: Course[];
  professors: Professor[];
  categories: Category[];
  visualCats: Category[];
  ruleCats: Category[];
  trackAssignments: TrackCourseAssignment[];
  
  // Selection Context (Persisted)
  selectedFacultyId: string;
  selectedMajorId: string;
  selectedTrackId: string;

  // General UI States (Persisted)
  activeTab: AdminTab;
  isSidebarCollapsed: boolean;
  activeTerm: string;
  
  loading: boolean;
  actionMessage: string | null;

  // Track which panels have loaded their data
  loadedPanels: LoadedPanels;

  // Actions
  setUser: (user: User | null) => void;
  setActiveTab: (tab: AdminTab) => void;
  setIsSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  setActiveTerm: (term: string) => void;
  setSelectedFacultyId: (id: string) => void;
  setSelectedMajorId: (id: string) => void;
  setSelectedTrackId: (id: string) => void;
  setActionMessage: (msg: string | null) => void;
  setFaculties: (faculties: Faculty[]) => void;
  setPhysicalFaculties: (physicalFaculties: PhysicalFaculty[]) => void;
  setMajors: (majors: Major[]) => void;
  setTracks: (tracks: Track[]) => void;
  setCourses: (courses: Course[]) => void;
  setProfessors: (professors: Professor[]) => void;
  setCategories: (categories: Category[]) => void;
  setVisualCats: (visualCats: Category[]) => void;
  setRuleCats: (ruleCats: Category[]) => void;
  setTrackAssignments: (assignments: TrackCourseAssignment[]) => void;

  // Granular panel loaders
  loadStructureData: (force?: boolean) => Promise<void>;
  loadPhysicalFaculties: (force?: boolean) => Promise<void>;
  loadCourses: (force?: boolean) => Promise<void>;
  loadProfessors: (force?: boolean) => Promise<void>;
  loadApprovedCharts: (force?: boolean) => Promise<void>;
  loadPanelData: (tab: AdminTab, force?: boolean) => Promise<void>;
  invalidatePanel: (tab: AdminTab | "all") => void;

  loadAllData: () => Promise<void>;
  loadTrackDetails: (trackId: string, force?: boolean) => Promise<void>;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      user: null,
      faculties: [],
      physicalFaculties: [],
      majors: [],
      tracks: [],
      courses: [],
      professors: [],
      categories: [],
      visualCats: [],
      ruleCats: [],
      trackAssignments: [],

      selectedFacultyId: "",
      selectedMajorId: "",
      selectedTrackId: "",

      activeTab: "structure",
      isSidebarCollapsed: false,
      activeTerm: "1403-1",

      loading: false,
      actionMessage: null,

      loadedPanels: {
        structure: false,
        physicalFaculties: false,
        courses: false,
        professors: false,
        offerings: false,
        events: false,
        categories: {},
        approvedCharts: false,
      },

      setUser: (user) => set({ user }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setIsSidebarCollapsed: (arg) =>
        set((state) => ({
          isSidebarCollapsed: typeof arg === "function" ? arg(state.isSidebarCollapsed) : arg,
        })),
      setActiveTerm: (activeTerm) => set({ activeTerm }),
      
      setSelectedFacultyId: (id) => {
        const { majors, tracks } = get();
        const relatedMajors = majors.filter((m) => m.facultyId === id);
        const firstMajorId = relatedMajors[0]?.id || "";
        const relatedTracks = tracks.filter((t) => t.majorId === firstMajorId);
        const firstTrackId = relatedTracks[0]?.id || "";

        set({
          selectedFacultyId: id,
          selectedMajorId: firstMajorId,
          selectedTrackId: firstTrackId,
        });

        if (firstTrackId) {
          get().loadTrackDetails(firstTrackId);
        }
      },

      setSelectedMajorId: (id) => {
        const { tracks } = get();
        const relatedTracks = tracks.filter((t) => t.majorId === id);
        const firstTrackId = relatedTracks[0]?.id || "";

        set({
          selectedMajorId: id,
          selectedTrackId: firstTrackId,
        });

        if (firstTrackId) {
          get().loadTrackDetails(firstTrackId);
        }
      },

      setSelectedTrackId: (id) => {
        set({ selectedTrackId: id });
        if (id) {
          get().loadTrackDetails(id);
        }
      },

      setActionMessage: (actionMessage) => set({ actionMessage }),

      setFaculties: (faculties) => set({ faculties }),
      setPhysicalFaculties: (physicalFaculties) => set({ physicalFaculties }),
      setMajors: (majors) => set({ majors }),
      setTracks: (tracks) => set({ tracks }),
      setCourses: (courses) => set({ courses }),
      setProfessors: (professors) => set({ professors }),
      setCategories: (categories) => set({ categories, visualCats: categories, ruleCats: categories }),
      setVisualCats: (visualCats) => set({ categories: visualCats, visualCats, ruleCats: visualCats }),
      setRuleCats: (ruleCats) => set({ categories: ruleCats, visualCats: ruleCats, ruleCats }),
      setTrackAssignments: (trackAssignments) => set({ trackAssignments }),

      loadStructureData: async (force = false) => {
        if (!force && get().loadedPanels.structure && get().faculties.length > 0) {
          return;
        }

        try {
          const [facRes, majRes, trkRes] = await Promise.all([
            fetchJson("/api/faculties"),
            fetchJson("/api/majors"),
            fetchJson("/api/tracks"),
          ]);

          const faculties = facRes.success ? facRes.data : [];
          const majors = majRes.success ? majRes.data : [];
          const tracks = trkRes.success ? trkRes.data : [];

          // Defensive fallback to direct localStorage in case of synchronous invocation before rehydration
          let currentSelectedFacultyId = get().selectedFacultyId;
          let currentSelectedMajorId = get().selectedMajorId;
          let currentSelectedTrackId = get().selectedTrackId;

          if (typeof window !== "undefined") {
            try {
              const raw = window.localStorage.getItem("ut_ece_admin_store");
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.state) {
                  if (!currentSelectedFacultyId && parsed.state.selectedFacultyId) {
                    currentSelectedFacultyId = parsed.state.selectedFacultyId;
                  }
                  if (!currentSelectedMajorId && parsed.state.selectedMajorId) {
                    currentSelectedMajorId = parsed.state.selectedMajorId;
                  }
                  if (!currentSelectedTrackId && parsed.state.selectedTrackId) {
                    currentSelectedTrackId = parsed.state.selectedTrackId;
                  }
                }
              }
            } catch {}
          }

          const effectiveFacultyId =
            currentSelectedFacultyId && faculties.some((f: Faculty) => f.id === currentSelectedFacultyId)
              ? currentSelectedFacultyId
              : faculties[0]?.id || "";

          const relatedMajors = majors.filter((m: Major) => m.facultyId === effectiveFacultyId);
          const effectiveMajorId =
            currentSelectedMajorId && relatedMajors.some((m: Major) => m.id === currentSelectedMajorId)
              ? currentSelectedMajorId
              : relatedMajors[0]?.id || "";

          const relatedTracks = tracks.filter((t: Track) => t.majorId === effectiveMajorId);
          const effectiveTrackId =
            currentSelectedTrackId && relatedTracks.some((t: Track) => t.id === currentSelectedTrackId)
              ? currentSelectedTrackId
              : relatedTracks[0]?.id || "";

          set((state) => ({
            faculties,
            majors,
            tracks,
            selectedFacultyId: effectiveFacultyId,
            selectedMajorId: effectiveMajorId,
            selectedTrackId: effectiveTrackId,
            loadedPanels: { ...state.loadedPanels, structure: true },
          }));
        } catch (e) {
          console.error("useAdminStore.loadStructureData error:", e);
        }
      },

      loadPhysicalFaculties: async (force = false) => {
        if (!force && get().loadedPanels.physicalFaculties && get().physicalFaculties.length > 0) {
          return;
        }

        try {
          const res = await fetchJson("/api/physical-faculties");
          if (res.success && Array.isArray(res.data)) {
            set((state) => ({
              physicalFaculties: res.data,
              loadedPanels: { ...state.loadedPanels, physicalFaculties: true },
            }));
          }
        } catch (e) {
          console.error("useAdminStore.loadPhysicalFaculties error:", e);
        }
      },

      loadCourses: async (force = false) => {
        if (!force && get().loadedPanels.courses && get().courses.length > 0) {
          return;
        }

        try {
          const res = await fetchJson("/api/courses");
          if (res.success && Array.isArray(res.data)) {
            set((state) => ({
              courses: res.data,
              loadedPanels: { ...state.loadedPanels, courses: true },
            }));
          }
        } catch (e) {
          console.error("useAdminStore.loadCourses error:", e);
        }
      },

      loadProfessors: async (force = false) => {
        if (!force && get().loadedPanels.professors && get().professors.length > 0) {
          return;
        }

        try {
          const res = await fetchJson("/api/professors");
          if (res.success && Array.isArray(res.data)) {
            set((state) => ({
              professors: res.data,
              loadedPanels: { ...state.loadedPanels, professors: true },
            }));
          }
        } catch (e) {
          console.error("useAdminStore.loadProfessors error:", e);
        }
      },

      loadApprovedCharts: async (force = false) => {
        if (!force && get().loadedPanels.approvedCharts) {
          return;
        }

        try {
          set((state) => ({
            loadedPanels: { ...state.loadedPanels, approvedCharts: true },
          }));
        } catch (e) {
          console.error("useAdminStore.loadApprovedCharts error:", e);
        }
      },

      loadTrackDetails: async (trackId: string, force = false) => {
        if (!trackId) return;
        if (!force && get().loadedPanels.categories[trackId]) {
          return;
        }

        try {
          const [catRes, assignRes] = await Promise.all([
            fetchJson(`/api/categories?trackId=${trackId}`),
            fetchJson(`/api/tracks/assignments?trackId=${trackId}`),
          ]);

          const categories = catRes.success
            ? (catRes.data.categories || catRes.data.items || catRes.data.rule || [])
            : [];

          set((state) => ({
            categories,
            visualCats: categories,
            ruleCats: categories,
            trackAssignments: assignRes.success ? assignRes.data : [],
            loadedPanels: {
              ...state.loadedPanels,
              categories: { ...state.loadedPanels.categories, [trackId]: true },
            },
          }));
        } catch (e) {
          console.error("useAdminStore.loadTrackDetails error:", e);
        }
      },

      loadPanelData: async (tab: AdminTab, force = false) => {
        // Ensure structure is always loaded first for top-bar context
        if (!get().loadedPanels.structure) {
          await get().loadStructureData();
        }

        switch (tab) {
          case "structure":
            if (force) await get().loadStructureData(true);
            break;
          case "physical-faculties":
            await get().loadPhysicalFaculties(force);
            break;
          case "courses":
            await get().loadCourses(force);
            break;
          case "professors":
            await get().loadProfessors(force);
            break;
          case "offerings":
            await Promise.all([
              get().loadCourses(force),
              get().loadProfessors(force),
            ]);
            break;
          case "categories":
            await get().loadCourses(force);
            if (get().selectedTrackId) {
              await get().loadTrackDetails(get().selectedTrackId, force);
            }
            break;
          case "rules":
            await get().loadCourses(force);
            if (get().selectedTrackId) {
              await get().loadTrackDetails(get().selectedTrackId, force);
            }
            break;
          case "approved-charts":
            await get().loadCourses(force);
            break;
          case "events":
          case "users":
          case "backup":
          case "trash":
          case "audit":
            break;
        }
      },

      invalidatePanel: (tab: AdminTab | "all") => {
        if (tab === "all") {
          set({
            loadedPanels: {
              structure: false,
              physicalFaculties: false,
              courses: false,
              professors: false,
              offerings: false,
              events: false,
              categories: {},
              approvedCharts: false,
            },
          });
          return;
        }

        set((state) => {
          const updated = { ...state.loadedPanels };
          if (tab === "structure") updated.structure = false;
          else if (tab === "physical-faculties") updated.physicalFaculties = false;
          else if (tab === "courses") updated.courses = false;
          else if (tab === "professors") updated.professors = false;
          else if (tab === "offerings") updated.offerings = false;
          else if (tab === "events") updated.events = false;
          else if (tab === "categories") updated.categories = {};
          else if (tab === "approved-charts") updated.approvedCharts = false;
          return { loadedPanels: updated };
        });
      },

      loadAllData: async () => {
        try {
          set({ loading: true });
          await Promise.all([
            get().loadStructureData(true),
            get().loadPhysicalFaculties(true),
            get().loadCourses(true),
            get().loadProfessors(true),
          ]);

          if (get().selectedTrackId) {
            await get().loadTrackDetails(get().selectedTrackId, true);
          }
        } catch (e) {
          console.error("useAdminStore.loadAllData error:", e);
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "ut_ece_admin_store",
      partialize: (state) => ({
        selectedFacultyId: state.selectedFacultyId,
        selectedMajorId: state.selectedMajorId,
        selectedTrackId: state.selectedTrackId,
        activeTab: state.activeTab,
        isSidebarCollapsed: state.isSidebarCollapsed,
        activeTerm: state.activeTerm,
      }),
    }
  )
);
