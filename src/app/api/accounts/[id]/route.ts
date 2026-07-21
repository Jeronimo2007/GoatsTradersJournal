import { NextResponse } from "next/server";
import { renameAccount, deleteAccount } from "@/lib/accountsStore";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const state = await renameAccount(id, name);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(state);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = await deleteAccount(id);
  if (!state) {
    return NextResponse.json(
      { error: "Cannot delete the last account" },
      { status: 400 }
    );
  }
  return NextResponse.json(state);
}
