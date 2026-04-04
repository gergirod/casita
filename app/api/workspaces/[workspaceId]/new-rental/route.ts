import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const schema = z.object({
  tenantName:     z.string().min(1),
  tenantEmail:    z.string().email().optional().or(z.literal("")),
  tenantWhatsapp: z.string().optional(),
  leaseStartDate: z.string().datetime().optional(),
  leaseEndDate:   z.string().datetime().optional(),
});

/**
 * POST /api/workspaces/[workspaceId]/new-rental
 *
 * Starts a fresh rental on an existing workspace.
 * Creates a new Unit (active) with the new tenant contact.
 * The previous unit(s) remain as historical records.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const owner = await requireOwnerFromRequest();
  if (!owner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { workspaceId } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: owner.id },
    include: {
      properties: { include: { units: { where: { isActive: true } } } },
    },
  });

  if (!workspace) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const property = workspace.properties[0];
  if (!property) return NextResponse.json({ error: "Sin propiedad" }, { status: 400 });

  const activeUnit = property.units[0];
  if (activeUnit) {
    return NextResponse.json(
      { error: "Ya hay un alquiler activo. Terminalo primero." },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { tenantName, tenantEmail, tenantWhatsapp, leaseStartDate, leaseEndDate } = parsed.data;

  const unit = await prisma.unit.create({
    data: {
      propertyId: property.id,
      identifier: "principal",
      isActive: true,
      tenantToken: randomUUID(),
      leaseEndDate: leaseEndDate ? new Date(leaseEndDate) : null,
      tenantContact: {
        create: {
          fullName: tenantName,
          email: tenantEmail || null,
          whatsapp: tenantWhatsapp || null,
        },
      },
    },
    include: { tenantContact: true },
  });

  return NextResponse.json({ ok: true, unitId: unit.id }, { status: 201 });
}
