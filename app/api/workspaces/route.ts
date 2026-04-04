import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const workspaceSchema = z.object({
  name: z.string().min(2),
  locale: z.string().default("es-AR"),
  currency: z.string().default("ARS"),
  timezone: z.string().default("America/Argentina/Buenos_Aires")
});

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = workspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await prisma.workspace.create({
    data: {
      ownerId: auth.user.id,
      ...parsed.data
    }
  });

  return NextResponse.json({ workspace }, { status: 201 });
}

export async function GET() {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: auth.user.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ workspaces });
}
