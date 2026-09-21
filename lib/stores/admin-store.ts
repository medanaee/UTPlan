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

  loadAllData: () => Promise<void>;
  loadTrackDetails: (trackId: string) => Promise<void>;
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

      loadAllData: async () => {
        try {
          set({ loading: true });
          const [facRes, majRes, trkRes, crsRes, prfRes, pfacRes] = await Promise.all([
            fetchJson("/api/faculties"),
            fetchJson("/api/majors"),
            fetchJson("/api/tracks"),
            fetchJson("/api/courses"),
            fetchJson("/api/professors"),
            fetchJson("/api/physical-faculties"),
          ]);

          const faculties = facRes.success ? facRes.data : [];
          const majors = majRes.success ? majRes.data : [];
          const tracks = trkRes.success ? trkRes.data : [];
          const courses = crsRes.success ? crsRes.data : [];
          const professors = prfRes.success ? prfRes.data : [];
          const physicalFaculties = pfacRes.success ? pfacRes.data : [];

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

          set({
            faculties,
            physicalFaculties,
            majors,
            tracks,
            courses,
            professors,
            selectedFacultyId: effectiveFacultyId,
            selectedMajorId: effectiveMajorId,
            selectedTrackId: effectiveTrackId,
            loading: false,
          });

          if (effectiveTrackId) {
            await get().loadTrackDetails(effectiveTrackId);
          }
        } catch (e) {
          console.error("useAdminStore.loadAllData error:", e);
          set({ loading: false });
        }
      },

      loadTrackDetails: async (trackId: string) => {
        if (!trackId) return;
        try {
          const [catRes, assignRes] = await Promise.all([
            fetchJson(`/api/categories?trackId=${trackId}`),
            fetchJson(`/api/tracks/assignments?trackId=${trackId}`),
          ]);

          const categories = catRes.success
            ? (catRes.data.categories || catRes.data.items || catRes.data.rule || [])
            : [];

          set({
            categories,
            visualCats: categories,
            ruleCats: categories,
            trackAssignments: assignRes.success ? assignRes.data : [],
          });
        } catch (e) {
          console.error("useAdminStore.loadTrackDetails error:", e);
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

