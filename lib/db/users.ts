import type { User } from "../types";
import { getD1 } from "./client";

export async function findUserByEmail(email: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  const d1 = getD1();
  if (!d1) return null;

  try {
    const row = await d1
      .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
      .bind(cleanEmail)
      .first();
    if (!row) return null;

    const fName = (row as any).first_name || "";
    const lName = (row as any).last_name || "";
    const fullName = (row as any).name || [fName, lName].filter(Boolean).join(" ") || "کاربر";

    return {
      id: (row as any).id,
      firstName: fName || undefined,
      lastName: lName || undefined,
      name: fullName,
      email: (row as any).email,
      role: (row as any).role as any,
      passwordHash: (row as any).password_hash,
      facultyId: (row as any).faculty_id || undefined,
      majorId: (row as any).major_id || undefined,
      trackId: (row as any).track_id || undefined,
      entrySemester: (row as any).entry_semester || undefined,
      avatarUrl: (row as any).avatar_url || undefined,
      createdAt: (row as any).created_at,
    };
  } catch (err) {
    console.error("D1 findUserByEmail error:", err);
    return null;
  }
}

export async function findUserById(id: string): Promise<User | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const row = await d1.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!row) return null;

    const fName = (row as any).first_name || "";
    const lName = (row as any).last_name || "";
    const fullName = (row as any).name || [fName, lName].filter(Boolean).join(" ") || "کاربر";

    return {
      id: (row as any).id,
      firstName: fName || undefined,
      lastName: lName || undefined,
      name: fullName,
      email: (row as any).email,
      role: (row as any).role as any,
      passwordHash: (row as any).password_hash,
      facultyId: (row as any).faculty_id || undefined,
      majorId: (row as any).major_id || undefined,
      trackId: (row as any).track_id || undefined,
      entrySemester: (row as any).entry_semester || undefined,
      avatarUrl: (row as any).avatar_url || undefined,
      createdAt: (row as any).created_at,
    };
  } catch (err) {
    console.error("D1 findUserById error:", err);
    return null;
  }
}

export async function getAllUsers(): Promise<User[]> {
  const d1 = getD1();
  if (!d1) return [];

  try {
    const { results } = await d1
      .prepare("SELECT * FROM users ORDER BY created_at DESC")
      .all();

    return (results || []).map((row: any) => {
      const fName = row.first_name || "";
      const lName = row.last_name || "";
      const fullName = row.name || [fName, lName].filter(Boolean).join(" ") || "کاربر";
      return {
        id: row.id,
        firstName: fName || undefined,
        lastName: lName || undefined,
        name: fullName,
        email: row.email,
        role: row.role as any,
        passwordHash: row.password_hash,
        facultyId: row.faculty_id || undefined,
        majorId: row.major_id || undefined,
        trackId: row.track_id || undefined,
        entrySemester: row.entry_semester || undefined,
        avatarUrl: row.avatar_url || undefined,
        createdAt: row.created_at,
      };
    });
  } catch (err) {
    console.error("D1 getAllUsers error:", err);
    return [];
  }
}

export async function createUser(data: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  passwordHash: string;
  role?: "super_admin" | "admin" | "user";
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string;
  avatarUrl?: string;
}): Promise<User> {
  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const cleanEmail = data.email.trim().toLowerCase();
  const role = data.role || "user";
  const now = new Date().toISOString();

  const firstName = (data.firstName || "").trim();
  const lastName = (data.lastName || "").trim();
  const fullName = data.name?.trim() || [firstName, lastName].filter(Boolean).join(" ") || "کاربر";

  const d1 = getD1();
  if (!d1) {
    throw new Error("پایگاه‌داده در دسترس نیست.");
  }

  try {
    await d1
      .prepare(
        `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, faculty_id, major_id, track_id, entry_semester, avatar_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        firstName,
        lastName,
        fullName,
        cleanEmail,
        data.passwordHash,
        role,
        data.facultyId || null,
        data.majorId || null,
        data.trackId || null,
        data.entrySemester || null,
        data.avatarUrl || null,
        now
      )
      .run();
  } catch (err) {
    console.error("D1 createUser error:", err);
    throw err;
  }

  return {
    id,
    firstName,
    lastName,
    name: fullName,
    email: cleanEmail,
    passwordHash: data.passwordHash,
    role,
    facultyId: data.facultyId,
    majorId: data.majorId,
    trackId: data.trackId,
    entrySemester: data.entrySemester,
    avatarUrl: data.avatarUrl,
    createdAt: now,
  };
}

export async function updateUserRole(
  userId: string,
  role: "super_admin" | "admin" | "user"
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, userId).run();
    return true;
  } catch (err) {
    console.error("D1 updateUserRole error:", err);
    return false;
  }
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<User, "firstName" | "lastName" | "name" | "facultyId" | "majorId" | "trackId" | "entrySemester" | "avatarUrl">>
): Promise<User | null> {
  const d1 = getD1();
  if (!d1) return null;

  try {
    const existing = await findUserById(userId);
    if (!existing) return null;

    const updatedFirstName = data.firstName !== undefined ? data.firstName.trim() : (existing.firstName || "");
    const updatedLastName = data.lastName !== undefined ? data.lastName.trim() : (existing.lastName || "");
    const updatedName =
      data.name !== undefined
        ? data.name.trim()
        : [updatedFirstName, updatedLastName].filter(Boolean).join(" ") || existing.name;

    const updatedFaculty = data.facultyId !== undefined ? data.facultyId : (existing.facultyId || null);
    const updatedMajor = data.majorId !== undefined ? data.majorId : (existing.majorId || null);
    const updatedTrack = data.trackId !== undefined ? data.trackId : (existing.trackId || null);
    const updatedSemester = data.entrySemester !== undefined ? data.entrySemester : (existing.entrySemester || null);
    const updatedAvatar = data.avatarUrl !== undefined ? data.avatarUrl : (existing.avatarUrl || null);

    await d1
      .prepare(
        `UPDATE users 
         SET first_name = ?, last_name = ?, name = ?, faculty_id = ?, major_id = ?, track_id = ?, entry_semester = ?, avatar_url = ?
         WHERE id = ?`
      )
      .bind(
        updatedFirstName,
        updatedLastName,
        updatedName,
        updatedFaculty,
        updatedMajor,
        updatedTrack,
        updatedSemester,
        updatedAvatar,
        userId
      )
      .run();

    return await findUserById(userId);
  } catch (err) {
    console.error("D1 updateUserProfile error:", err);
    return null;
  }
}

export async function changeUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;

  try {
    await d1
      .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(newPasswordHash, userId)
      .run();
    return true;
  } catch (err) {
    console.error("D1 changeUserPassword error:", err);
    return false;
  }
}
