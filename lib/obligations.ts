import { ObligationStatus, ObligationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildExternalReference, createMercadoPagoPaymentLink } from "@/lib/mercado-pago";

export function normalizeDueDate(year: number, monthOneBased: number, dueDay: number) {
  const lastDay = new Date(Date.UTC(year, monthOneBased, 0)).getUTCDate();
  const safeDay = Math.max(1, Math.min(dueDay, lastDay));
  return new Date(Date.UTC(year, monthOneBased - 1, safeDay, 12, 0, 0));
}

export function getInitialStatusFromDueDate(dueDate: Date) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  const obligationDay = new Date(
    Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate(), 12, 0, 0)
  );

  if (obligationDay.getTime() < today.getTime()) {
    return ObligationStatus.overdue;
  }

  if (obligationDay.getTime() === today.getTime()) {
    return ObligationStatus.pending;
  }

  return ObligationStatus.upcoming;
}

export async function generateMonthlyRentObligationsForOwner(input: {
  ownerId: string;
  referenceDate?: Date;
}) {
  const referenceDate = input.referenceDate ?? new Date();
  const year = referenceDate.getUTCFullYear();
  const monthOneBased = referenceDate.getUTCMonth() + 1;
  const monthStartUtc = new Date(Date.UTC(year, monthOneBased - 1, 1, 0, 0, 0));

  const templates = await prisma.obligationTemplate.findMany({
    where: {
      isActive: true,
      type: ObligationType.rent,
      unit: {
        property: {
          workspace: {
            ownerId: input.ownerId
          }
        }
      }
    },
    include: {
      unit: {
        include: {
          tenantContact: true,
          property: {
            include: {
              workspace: {
                select: {
                  mpEnabled: true,
                  mpAccessTokenEncrypted: true,
                },
              },
            },
          },
        },
      },
    }
  });

  let created = 0;

  for (const template of templates) {
    const dueDate = normalizeDueDate(year, monthOneBased, template.dueDay);
    const status = getInitialStatusFromDueDate(dueDate);
    const existing = await prisma.obligation.findUnique({
      where: {
        templateId_dueMonth: {
          templateId: template.id,
          dueMonth: monthStartUtc
        }
      },
      select: { id: true }
    });

    if (existing) continue;

    const obligation = await prisma.obligation.create({
      data: {
        unitId: template.unitId,
        templateId: template.id,
        type: template.type,
        sourceType: "recurring_rent",
        title: template.title,
        amount: template.amount,
        dueDate,
        dueMonth: monthStartUtc,
        status
      }
    });

    const workspace = template.unit.property.workspace;
    if (workspace.mpEnabled && workspace.mpAccessTokenEncrypted) {
      const externalReference = buildExternalReference(obligation.id);
      const link = await createMercadoPagoPaymentLink(
        {
          enabled: workspace.mpEnabled,
          accessTokenEncrypted: workspace.mpAccessTokenEncrypted,
        },
        {
          obligationId: obligation.id,
          title: template.title,
          amount: Number(template.amount),
          externalReference,
          payerEmail: template.unit.tenantContact?.email ?? null,
        }
      );

      if (link.ok) {
        await prisma.obligation.update({
          where: { id: obligation.id },
          data: {
            paymentProvider: "mercado_pago",
            paymentLinkUrl: link.checkoutUrl,
            paymentExternalRef: link.externalReference,
          },
        });
      }
    }
    created += 1;
  }

  return { created, templates: templates.length, monthStartUtc };
}

export function toPrismaDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}
