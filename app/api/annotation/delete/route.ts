import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { supabaseAdmin, BUCKET } from "@/lib/supabase-admin";

// ── Local helpers (keep local disk in sync) ───────────────────────────────────
const LOCAL_BASE = (section: "manual" | "esophagitis") =>
  path.join(process.cwd(), "annotation_output", section);

async function tryUnlink(p: string) {
  try { await fs.unlink(p); } catch {}
}

async function removeFromJson(filename: string) {
  const jsonPath = path.join(LOCAL_BASE("manual"), "annotations.json");
  try {
    const raw     = await fs.readFile(jsonPath, "utf-8");
    const parsed  = JSON.parse(raw);
    parsed.images = (parsed.images ?? []).filter((img: any) => img.filename !== filename);
    parsed.updated_at = new Date().toISOString();
    await fs.writeFile(jsonPath, JSON.stringify(parsed, null, 2));
  } catch {}
}

// DELETE /api/annotation/delete
// body: { action: "file",   filename: "img.jpg", section?: "manual"|"esophagitis" }
//       { action: "folder", folder: "images"|"masks"|"all", section?: "manual"|"esophagitis" }
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as {
      action:   "file" | "folder";
      filename?: string;
      folder?:   "images" | "masks" | "all";
      section?:  "manual" | "esophagitis";
    };

    const section: "manual" | "esophagitis" =
      body.section === "esophagitis" ? "esophagitis" : "manual";

    // ── Delete single file ──────────────────────────────────────────────────
    if (body.action === "file") {
      const { filename } = body;
      if (!filename || filename.includes("..")) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
      }
      const baseName = path.parse(filename).name;

      // Supabase
      await supabaseAdmin.storage.from(BUCKET).remove([
        `${section}/images/${filename}`,
        `${section}/masks/${baseName}.png`,
        `${section}/masks/${baseName}_mask.png`,
      ]);

      // Local disk
      const base = LOCAL_BASE(section);
      await tryUnlink(path.join(base, "images", filename));
      await tryUnlink(path.join(base, "masks", `${baseName}.png`));
      await tryUnlink(path.join(base, "masks", `${baseName}_mask.png`));
      if (section === "manual") await removeFromJson(filename);

      return NextResponse.json({ success: true });
    }

    // ── Clear a whole folder ────────────────────────────────────────────────
    if (body.action === "folder") {
      const { folder } = body;
      const base = LOCAL_BASE(section);

      const clearSupabaseFolder = async (subdir: "images" | "masks") => {
        const { data } = await supabaseAdmin.storage
          .from(BUCKET)
          .list(`${section}/${subdir}`, { limit: 1000 });
        const paths = (data ?? [])
          .filter(f => f.name !== ".emptyFolderPlaceholder")
          .map(f => `${section}/${subdir}/${f.name}`);
        if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);
      };

      if (folder === "images" || folder === "all") {
        await clearSupabaseFolder("images");
        const files = await fs.readdir(path.join(base, "images")).catch(() => [] as string[]);
        await Promise.all(files.map(f => tryUnlink(path.join(base, "images", f))));
        if (folder === "all" && section === "manual") {
          await tryUnlink(path.join(base, "annotations.json"));
        }
      }
      if (folder === "masks" || folder === "all") {
        await clearSupabaseFolder("masks");
        const files = await fs.readdir(path.join(base, "masks")).catch(() => [] as string[]);
        await Promise.all(files.map(f => tryUnlink(path.join(base, "masks", f))));
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[annotation/delete]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
