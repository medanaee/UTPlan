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
  VisualCategory,
  RuleCategory,
  TrackCourseAssignment,
} from "@/lib/types";

export type AdminTab =
  | "structure"
  | "courses"
  | "offerings"
  | "events"
  | "professors"
  | "categories"
  | "approved-charts"
  | "rules"
  | "users"
  | "backup"
  | "trash";

interface AdminState {
  user: User | null;
  faculties: Faculty[];
  majors: Major[];
  tracks: Track[];
  courses: Course[];
  professors: Professor[];
  visualCats: VisualCategory[];
  ruleCats: RuleCategory[];
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
  setMajors: (majors: Major[]) => void;
  setTracks: (tracks: Track[]) => void;
  setCourses: (courses: Course[]) => void;
  setProfessors: (professors: Professor[]) => void;
  setVisualCats: (visualCats: VisualCategory[]) => void;
  setRuleCats: (ruleCats: RuleCategory[]) => void;
  setTrackAssignments: (assignments: TrackCourseAssignment[]) => void;

  loadAllData: () => Promise<void>;
  loadTrackDetails: (trackId: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      user: null,
      faculties: [],
      majors: [],
      tracks: [],
      courses: [],
      professors: [],
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

      setActionMessage: (actionMessage) => {
        set({ actionMessage });
        if (actionMessage) {
          setTimeout(() => {
            if (get().actionMessage === actionMessage) {
              set({ actionMessage: null });
            }
          }, 4000);
        }
      },

      setFaculties: (faculties) => set({ faculties }),
      setMajors: (majors) => set({ majors }),
      setTracks: (tracks) => set({ tracks }),
      setCourses: (courses) => set({ courses }),
      setProfessors: (professors) => set({ professors }),
      setVisualCats: (visualCats) => set({ visualCats }),
      setRuleCats: (ruleCats) => set({ ruleCats }),
      setTrackAssignments: (trackAssignments) => set({ trackAssignments }),

      loadAllData: async () => {
        try {
          set({ loading: true });
          const [facRes, majRes, trkRes, crsRes, prfRes] = await Promise.all([
            fetchJson("/api/faculties"),
            fetchJson("/api/majors"),
            fetchJson("/api/tracks"),
            fetchJson("/api/courses"),
            fetchJson("/api/professors"),
          ]);

          const faculties = facRes.success ? facRes.data : [];
          const majors = majRes.success ? majRes.data : [];
          const tracks = trkRes.success ? trkRes.data : [];
          const courses = crsRes.success ? crsRes.data : [];
          const professors = prfRes.success ? prfRes.data : [];

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

          set({
            visualCats: catRes.success ? catRes.data.visual : [],
            ruleCats: catRes.success ? catRes.data.rule : [],
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

