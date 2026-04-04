import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { toPrismaDecimal } from "@/lib/obligations";
import type { ServiceResult } from "@/lib/services/obligations";

// ─── createWorkspace ─────────────────────────────────────────────
//
// Creates a new workspace + property + unit in a single transaction.
// Optionally creates a tenant contact and/or a rent obligation template.
//
// No ownership check needed — ownerId is the creator, not an accessor.

export interface CreateWorkspaceInput {
  ownerId: string;
  name: string;
  tenant?: {
    fullName: string;
    email?: string;
    whatsapp?: string;
  };
  rent?: {
    amount: number;
    currency?: string;
    dueDay: number;
  };
}

export async function createWorkspace(
  input: CreateWorkspaceInput
): Promise<ServiceResult<{ workspaceId: string; unitId: string }>> {
  const result = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({ data: { ownerId: input.ownerId, name: input.name } });
    const prop = await tx.property.create({ data: { workspaceId: ws.id, name: input.name } });
    const unit = await tx.unit.create({
      data: { propertyId: prop.id, identifier: "principal", tenantToken: randomUUID() },
    });

    if (input.tenant) {
      await tx.tenantContact.create({
        data: {
          unitId: unit.id,
          fullName: input.tenant.fullName,
          email: input.tenant.email ?? null,
          whatsapp: input.tenant.whatsapp ?? null,
        },
      });
    }

    if (input.rent) {
      await tx.obligationTemplate.create({
        data: {
          unitId: unit.id,
          type: "rent",
          title: `Alquiler ${input.name}`,
          amount: toPrismaDecimal(input.rent.amount),
          currency: input.rent.currency ?? "ARS",
          dueDay: input.rent.dueDay,
        },
      });
    }

    return { workspaceId: ws.id, unitId: unit.id };
  });

  return { ok: true, data: result };
}

// ─── registerTenant ──────────────────────────────────────────────
//
// Registers a new tenant for an existing workspace.
// Validates ownership and vacancy (no active unit must exist first).

export interface RegisterTenantInput {
  ownerId: string;
  workspaceId: string;
  tenantName: string;
  tenantEmail?: string;
  tenantWhatsapp?: string;
  leaseEndDate?: string;
}

export async function registerTenant(
  input: RegisterTenantInput
): Promise<ServiceResult<{ unitId: string }>> {
  const ws = await prisma.workspace.findFirst({
    where: { id: input.workspaceId, ownerId: input.ownerId },
    include: { properties: { include: { units: { where: { isActive: true } } } } },
  });

  if (!ws) return { ok: false, error: "Casita no encontrada.", code: "not_found" };

  const property = ws.properties[0];
  if (!property) return { ok: false, error: "Sin propiedad en esta casita.", code: "not_found" };

  if (property.units[0]) {
    return { ok: false, error: "Ya hay un alquiler activo. Terminalo primero.", code: "conflict" };
  }

  const unit = await prisma.unit.create({
    data: {
      propertyId: property.id,
      identifier: "principal",
      isActive: true,
      tenantToken: randomUUID(),
      leaseEndDate: input.leaseEndDate ? new Date(input.leaseEndDate) : null,
      tenantContact: {
        create: {
          fullName: input.tenantName,
          email: input.tenantEmail ?? null,
          whatsapp: input.tenantWhatsapp ?? null,
        },
      },
    },
  });

  return { ok: true, data: { unitId: unit.id } };
}

// ─── endRental ───────────────────────────────────────────────────
//
// Marks the active rental as ended.
// Deactivates the unit and all its obligation templates atomically.
// Validates ownership via workspace ownerId.

export interface EndRentalInput {
  ownerId: string;
  workspaceId: string;
}

export async function endRental(
  input: EndRentalInput
): Promise<ServiceResult<{ unitId: string }>> {
  const unit = await prisma.unit.findFirst({
    where: {
      property: { workspaceId: input.workspaceId, workspace: { ownerId: input.ownerId } },
      isActive: true,
    },
    select: { id: true },
  });

  if (!unit) return { ok: false, error: "No hay alquiler activo.", code: "not_found" };

  await prisma.$transaction([
    prisma.unit.update({ where: { id: unit.id }, data: { isActive: false, leaseEndDate: new Date() } }),
    prisma.obligationTemplate.updateMany({ where: { unitId: unit.id }, data: { isActive: false } }),
  ]);

  return { ok: true, data: { unitId: unit.id } };
}

// ─── updateRentAmount ────────────────────────────────────────────
//
// Updates the amount on the active rent obligation template.
// Validates ownership and that an active rent template exists.

export interface UpdateRentAmountInput {
  ownerId: string;
  workspaceId: string;
  newAmount: number;
}

export async function updateRentAmount(
  input: UpdateRentAmountInput
): Promise<ServiceResult<{ templateId: string; currency: string; newAmount: number }>> {
  const unit = await prisma.unit.findFirst({
    where: {
      property: { workspaceId: input.workspaceId, workspace: { ownerId: input.ownerId } },
      isActive: true,
    },
    select: { id: true },
  });

  if (!unit) return { ok: false, error: "No hay unidad activa.", code: "not_found" };

  const template = await prisma.obligationTemplate.findFirst({
    where: { unitId: unit.id, type: "rent", isActive: true },
  });

  if (!template) return { ok: false, error: "No hay template de alquiler activo.", code: "not_found" };

  await prisma.obligationTemplate.update({
    where: { id: template.id },
    data: { amount: toPrismaDecimal(input.newAmount) },
  });

  return { ok: true, data: { templateId: template.id, currency: template.currency, newAmount: input.newAmount } };
}

// ─── deleteWorkspace ─────────────────────────────────────────────
//
// Permanently deletes a workspace and all its cascading data.
// Requires explicit confirmation string "SI BORRAR" — this guard lives
// in the service, not the agent, because it is a business rule.
// Validates ownership before deletion.

export interface DeleteWorkspaceInput {
  ownerId: string;
  workspaceId: string;
  confirmation: string;
}

export async function deleteWorkspace(
  input: DeleteWorkspaceInput
): Promise<ServiceResult<{ name: string }>> {
  if (input.confirmation !== "SI BORRAR") {
    return {
      ok: false,
      error: "Para borrar, el owner debe confirmar con 'SI BORRAR'.",
      code: "invalid_input",
    };
  }

  const ws = await prisma.workspace.findFirst({
    where: { id: input.workspaceId, ownerId: input.ownerId },
    select: { id: true, name: true },
  });

  if (!ws) return { ok: false, error: "Casita no encontrada.", code: "not_found" };

  await prisma.workspace.delete({ where: { id: input.workspaceId } });

  return { ok: true, data: { name: ws.name } };
}
