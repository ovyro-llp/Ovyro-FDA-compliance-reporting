import { prisma } from "@/lib/db";

export interface OnboardingAnswers {
  businessType: "RESTAURANT" | "CLOUD_KITCHEN" | "CAFE" | "MANUFACTURING";
  facilityName: string;
  shifts: string[];
  contactPhone?: string;
  modules: {
    hasColdStorage: boolean;
    hasFryers: boolean;
    hasDeliveryDispatch: boolean;
    hasEspressoBeverage: boolean;
    hasRawMaterialIntake: boolean;
    hasPestControl: boolean;
  };
}

/**
 * Dynamically generates and places custom compliance templates into the organization's facility
 * based on the exact operational profile answered by the business owner during onboarding.
 */
export async function generateTailoredTemplatesForOrg(
  organizationId: string,
  outletId: string,
  answers: OnboardingAnswers
) {
  // 1. Remove existing default unsubmitted starter templates for clean placement
  const existingOutletTemplates = await prisma.outletTemplate.findMany({
    where: { outletId },
    include: { template: true },
  });

  for (const ot of existingOutletTemplates) {
    // Check if template has any submissions; if not, safely unlink from this outlet
    const submissionCount = await prisma.formSubmission.count({
      where: { templateId: ot.templateId },
    });
    if (submissionCount === 0) {
      await prisma.outletTemplate.deleteMany({ where: { templateId: ot.templateId, outletId } });
      const otherOutletsUsing = await prisma.outletTemplate.count({
        where: { templateId: ot.templateId },
      });
      if (otherOutletsUsing === 0) {
        await prisma.userTemplateAccess.deleteMany({ where: { templateId: ot.templateId } });
        await prisma.formTemplate.delete({ where: { id: ot.templateId } }).catch(() => {});
      }
    }
  }

  const templatesToCreate: Array<{
    title: string;
    slug: string;
    category: string;
    icon: string;
    frequency: string;
    description: string;
    schema: any;
  }> = [];

  // MODULE A: Foundational Daily Housekeeping & Sanitization SOP (Tailored to Business Type)
  if (answers.businessType === "CLOUD_KITCHEN") {
    templatesToCreate.push({
      title: "Cloud Kitchen Daily Hygiene & Sanitization SOP",
      slug: "cloud-kitchen-hygiene-sop",
      category: "HOUSEKEEPING",
      icon: "🧹",
      frequency: "SHIFT_WISE",
      description: "Comprehensive hygiene log for high-velocity delivery prep stations and packaging zones.",
      schema: {
        sections: [
          {
            id: "sec-ck-1",
            title: "Production Line & Stainless Surfaces",
            items: [
              { id: "ck-1", name: "Stainless prep counters sanitized with food-grade quat disinfectant (200 ppm)", defaultAssignee: "Kitchen Line" },
              { id: "ck-2", name: "Cookline exhaust hoods, grease baffles & induction tops wiped", defaultAssignee: "Kitchen Line" },
              { id: "ck-3", name: "Handwash stations stocked with sensor soap, warm water & paper rolls", defaultAssignee: "Floor Staff" },
              { id: "ck-4", name: "Floor drains treated with enzymatic cleaner & biocide flush", defaultAssignee: "Floor Staff" },
            ],
          },
          {
            id: "sec-ck-2",
            title: "Packaging & Delivery Staging Zone",
            items: [
              { id: "ck-5", name: "Packaging assembly table sanitized every 2 hours", defaultAssignee: "Packer" },
              { id: "ck-6", name: "Tamper-evident security sticker rolls audited & restocked", defaultAssignee: "Packer" },
              { id: "ck-7", name: "Trash and wet waste bins sealed, cleared & re-lined", defaultAssignee: "Floor Staff" },
            ],
          },
        ],
      },
    });
  } else if (answers.businessType === "CAFE") {
    templatesToCreate.push({
      title: "Cafe & Bakery Daily Hygiene SOP",
      slug: "cafe-bakery-hygiene-sop",
      category: "HOUSEKEEPING",
      icon: "☕",
      frequency: "SHIFT_WISE",
      description: "Front-of-house espresso station, pastry display sanitization, and washroom compliance.",
      schema: {
        sections: [
          {
            id: "sec-cafe-1",
            title: "Coffee Bar & Service Counter",
            items: [
              { id: "cf-1", name: "Knock box emptied, sanitized & portafilters soaked", defaultAssignee: "Barista" },
              { id: "cf-2", name: "Service counter & POS tablet disinfected with alcohol wipes", defaultAssignee: "Barista" },
              { id: "cf-3", name: "Milk pitcher rinser basin cleared of dairy residue", defaultAssignee: "Barista" },
              { id: "cf-4", name: "Ice machine bin sanitized and scoop stored in dry holder", defaultAssignee: "Barista" },
            ],
          },
          {
            id: "sec-cafe-2",
            title: "Bakery Prep & Guest Restrooms",
            items: [
              { id: "cf-5", name: "Bakery display tongs, trays & sneeze guards cleaned", defaultAssignee: "Floor Staff" },
              { id: "cf-6", name: "Guest restrooms verified (soap, dry towels, clean mirrors)", defaultAssignee: "Floor Staff" },
            ],
          },
        ],
      },
    });
  } else if (answers.businessType === "MANUFACTURING") {
    templatesToCreate.push({
      title: "Food Processing Facility Sanitation Log",
      slug: "processing-facility-sanitation",
      category: "HOUSEKEEPING",
      icon: "🏭",
      frequency: "SHIFT_WISE",
      description: "Industrial clean-in-place (CIP) and processing zone chemical sanitization record.",
      schema: {
        sections: [
          {
            id: "sec-mfg-1",
            title: "Processing Halls & Clean Rooms",
            items: [
              { id: "mf-1", name: "Processing conveyors wiped with food-grade sanitizing foam", defaultAssignee: "Sanitation Lead" },
              { id: "mf-2", name: "Personnel air showers, footbaths & hand wash locks verified", defaultAssignee: "QA Lead" },
              { id: "mf-3", name: "Positive air pressure gauges and HEPA filter intakes checked", defaultAssignee: "Maintenance" },
              { id: "mf-4", name: "Floor drains disinfected with chlorine solution (>1000 ppm)", defaultAssignee: "Sanitation Staff" },
            ],
          },
        ],
      },
    });
  } else {
    // Standard Restaurant
    templatesToCreate.push({
      title: "Daily Kitchen Housekeeping & FSSAI Hygiene SOP",
      slug: "daily-kitchen-housekeeping-sop",
      category: "HOUSEKEEPING",
      icon: "🧹",
      frequency: "SHIFT_WISE",
      description: "Daily hygiene & sanitization checklist across hot range, prep line, and service pass.",
      schema: {
        sections: [
          {
            id: "sec-res-1",
            title: "Kitchen Hot Line & Dishwashing",
            items: [
              { id: "res-1", name: "Prep tables sanitized with food-grade disinfectant", defaultAssignee: "Commis Chef" },
              { id: "res-2", name: "Dishwashing wash tank (>60°C) and sanitizing rinse (>82°C)", defaultAssignee: "Stewarding" },
              { id: "res-3", name: "Cutting boards color-coded & sanitized (Red/Meat, Green/Veg)", defaultAssignee: "Prep Cook" },
              { id: "res-4", name: "Waste bins cleared, sanitized & fresh liners fitted", defaultAssignee: "Stewarding" },
            ],
          },
        ],
      },
    });
  }

  // MODULE B: Cold Storage & Refrigeration (If hasColdStorage checked)
  if (answers.modules.hasColdStorage) {
    templatesToCreate.push({
      title: "Cold Chain & Refrigeration Temperature Log",
      slug: "cold-chain-refrigeration-log",
      category: "TEMPERATURE",
      icon: "🧊",
      frequency: "DAILY",
      description: "HACCP & FSSAI compliant temperature monitoring for chillers, walk-ins, and deep freezers.",
      schema: {
        sections: [
          {
            id: "sec-temp-1",
            title: "Chilled Storage (Target: +1.0°C to +4.0°C)",
            items: [
              { id: "tc-1", name: "Walk-in Dairy & Produce Chiller", machineNumber: "CH-01", targetMinTemp: 1.0, targetMaxTemp: 4.0 },
              { id: "tc-2", name: "Cooked Food & Prep Chiller", machineNumber: "CH-02", targetMinTemp: 1.0, targetMaxTemp: 4.0 },
              { id: "tc-3", name: "Raw Meat & Poultry Chiller", machineNumber: "CH-03", targetMinTemp: 0.5, targetMaxTemp: 3.5 },
            ],
          },
          {
            id: "sec-temp-2",
            title: "Deep Freezers (Target: -22.0°C to -18.0°C)",
            items: [
              { id: "tf-1", name: "Hardening / Deep Storage Freezer", machineNumber: "FZ-01", targetMinTemp: -22.0, targetMaxTemp: -18.0 },
              { id: "tf-2", name: "Ice Cream & Frozen Dessert Vault", machineNumber: "FZ-02", targetMinTemp: -20.0, targetMaxTemp: -16.0 },
            ],
          },
        ],
      },
    });
  }

  // MODULE C: Commercial Fryers & Cooking Oil Quality (If hasFryers checked)
  if (answers.modules.hasFryers) {
    templatesToCreate.push({
      title: "Cooking Oil Quality & TPC % Safety Log",
      slug: "cooking-oil-tpc-safety-log",
      category: "EQUIPMENT",
      icon: "🍳",
      frequency: "DAILY",
      description: "Daily Total Polar Compounds (TPC % < 25), filtration schedule, and oil discard tracking.",
      schema: {
        sections: [
          {
            id: "sec-oil-1",
            title: "Commercial Fryer Stations",
            items: [
              { id: "oil-1", name: "Station 1 Fryer — Oil TPC % Test (<25% legal limit)", machineNumber: "FRY-01", defaultAssignee: "Fry Station Lead" },
              { id: "oil-2", name: "Station 1 Fryer — Temperature Sensor Calibration (175°C - 185°C)", machineNumber: "FRY-01", defaultAssignee: "Fry Station Lead" },
              { id: "oil-3", name: "Station 2 Fryer — Oil TPC % Test (<25% legal limit)", machineNumber: "FRY-02", defaultAssignee: "Fry Station Lead" },
              { id: "oil-4", name: "Daily sediment filter paper replaced & heating elements wiped", defaultAssignee: "Stewarding" },
            ],
          },
        ],
      },
    });
  }

  // MODULE D: Online Delivery Dispatch & Packaging Safety (If hasDeliveryDispatch checked)
  if (answers.modules.hasDeliveryDispatch) {
    templatesToCreate.push({
      title: "Delivery Dispatch & Tamper-Evident Safety Log",
      slug: "delivery-dispatch-safety-log",
      category: "DISPATCH",
      icon: "🛵",
      frequency: "SHIFT_WISE",
      description: "Hot food core dispatch temperature (>65°C), cold food safety (<5°C), and bag sealing verification.",
      schema: {
        sections: [
          {
            id: "sec-disp-1",
            title: "Dispatch Window & Handover QA",
            items: [
              { id: "dp-1", name: "Hot food packaging core temperature checked (>65°C)", defaultAssignee: "Dispatch Lead" },
              { id: "dp-2", name: "Cold desserts / drinks dispatch temperature checked (<5°C)", defaultAssignee: "Dispatch Lead" },
              { id: "dp-3", name: "Tamper-evident security tape/seal verified intact on all bags", defaultAssignee: "Dispatch Lead" },
              { id: "dp-4", name: "Rider delivery bag sanitized before order placement", defaultAssignee: "Dispatch Lead" },
            ],
          },
        ],
      },
    });
  }

  // MODULE E: Espresso Machinery, Steam Wands & Water TDS (If hasEspressoBeverage checked)
  if (answers.modules.hasEspressoBeverage) {
    templatesToCreate.push({
      title: "Commercial Beverage, Steam Wand & Water TDS Log",
      slug: "beverage-steam-wand-tds-log",
      category: "EQUIPMENT",
      icon: "☕",
      frequency: "DAILY",
      description: "Espresso group head chemical backflush, steam wand dairy purge, and RO filter TDS PPM audit.",
      schema: {
        sections: [
          {
            id: "sec-bev-1",
            title: "Espresso & Steam Sanitation",
            items: [
              { id: "bv-1", name: "Steam wands soaked in food-grade milk cleaner & unblocked", defaultAssignee: "Head Barista" },
              { id: "bv-2", name: "Group heads backflushed with blind basket & detergent powder", defaultAssignee: "Head Barista" },
              { id: "bv-3", name: "Grinder hopper wiped clean of coffee oil buildup", defaultAssignee: "Head Barista" },
            ],
          },
          {
            id: "sec-bev-2",
            title: "Water Filtration & RO Purity",
            items: [
              { id: "bv-4", name: "RO Water Filter TDS Hardness Reading (Target: 70 - 150 PPM)", machineNumber: "RO-01", defaultAssignee: "Maintenance" },
              { id: "bv-5", name: "UV filtration lamp operational check", machineNumber: "RO-01", defaultAssignee: "Maintenance" },
            ],
          },
        ],
      },
    });
  }

  // MODULE F: Raw Material Receiving, COA & Moisture QA (If hasRawMaterialIntake checked)
  if (answers.modules.hasRawMaterialIntake) {
    templatesToCreate.push({
      title: "Raw Material Intake, COA & Batch Quality Log",
      slug: "raw-material-intake-batch-qa",
      category: "RECEIVING",
      icon: "📦",
      frequency: "DAILY",
      description: "Supplier Certificate of Analysis (COA) verification, vehicle hygiene, and ingredient triage.",
      schema: {
        sections: [
          {
            id: "sec-raw-1",
            title: "Supplier Inward Verification",
            items: [
              { id: "rm-1", name: "Delivery vehicle clean, dry, free of chemical contaminants", defaultAssignee: "Receiving Officer" },
              { id: "rm-2", name: "Supplier batch Certificate of Analysis (COA) checked & filed", defaultAssignee: "Receiving Officer" },
              { id: "rm-3", name: "Chilled raw material delivery temperature (<4°C verified)", defaultAssignee: "Receiving Officer" },
              { id: "rm-4", name: "Packaging integrity verified: no tears, leaks, or pest damage", defaultAssignee: "Receiving Officer" },
              { id: "rm-5", name: "FIFO / Expiry date barcode tagging applied before storage", defaultAssignee: "Receiving Officer" },
            ],
          },
        ],
      },
    });
  }

  // MODULE G: Pest Control & Light Traps (If hasPestControl checked)
  if (answers.modules.hasPestControl) {
    templatesToCreate.push({
      title: "Pest Management & Insect Light Trap Audit",
      slug: "pest-management-light-trap-audit",
      category: "FACILITY",
      icon: "🪤",
      frequency: "WEEKLY",
      description: "Inspection of glue boards, insect light traps (ILTs), and external exclusion barriers.",
      schema: {
        sections: [
          {
            id: "sec-pest-1",
            title: "Pest Trap & Exclusion Inspection",
            items: [
              { id: "pt-1", name: "Insect light traps (ILTs) operational, clean & catch pads inspected", defaultAssignee: "Facility Lead" },
              { id: "pt-2", name: "Rodent bait boxes intact, locked & tamper-free", defaultAssignee: "Facility Lead" },
              { id: "pt-3", name: "Door brush sweeps and air curtains operational on all exits", defaultAssignee: "Facility Lead" },
            ],
          },
        ],
      },
    });
  }

  // Persist all templates in database and link to outlet
  const createdTemplates = [];
  let order = 0;

  for (const tpl of templatesToCreate) {
    const created = await prisma.formTemplate.create({
      data: {
        organizationId,
        title: tpl.title,
        slug: `${tpl.slug}-${Date.now().toString().slice(-4)}`,
        category: tpl.category,
        icon: tpl.icon,
        frequency: tpl.frequency,
        description: tpl.description,
        schema: JSON.stringify(tpl.schema),
      },
    });

    await prisma.outletTemplate.create({
      data: {
        outletId,
        templateId: created.id,
        order: order++,
        isEnabled: true,
      },
    });

    createdTemplates.push(created);
  }

  return createdTemplates;
}
