-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ES', 'GN', 'PT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('AI', 'NATURAL_MOUNT');

-- CreateEnum
CREATE TYPE "PregnancyCheckMethod" AS ENUM ('ULTRASOUND', 'BLOOD_TEST', 'VISUAL');

-- CreateEnum
CREATE TYPE "PregnancyCheckResult" AS ENUM ('PREGNANT', 'NOT_PREGNANT', 'RECHECK');

-- CreateEnum
CREATE TYPE "FarrowingType" AS ENUM ('NORMAL', 'ASSISTED', 'CESAREAN', 'DYSTOCIA');

-- CreateEnum
CREATE TYPE "PigletSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PigletIdentType" AS ENUM ('TATTOO', 'EAR_TAG');

-- CreateEnum
CREATE TYPE "PigletStatus" AS ENUM ('VIABLE', 'LOW_VIABILITY');

-- CreateEnum
CREATE TYPE "PigletDeathCause" AS ENUM ('WEAKNESS', 'CRUSHING', 'DIARRHEA', 'DEFICIENT', 'DISEASE', 'SHELTER', 'HYPOTHERMIA', 'ACCIDENT', 'CONGENITAL', 'ELIMINATED', 'OTHER');

-- CreateEnum
CREATE TYPE "SowDisposalDestination" AS ENUM ('GESTATION', 'CULL', 'OTHER');

-- CreateEnum
CREATE TYPE "BodyConditionScore" AS ENUM ('SCORE_1', 'SCORE_2', 'SCORE_3', 'SCORE_4', 'SCORE_5');

-- CreateEnum
CREATE TYPE "StockAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NurseryPhase" AS ENUM ('PHASE_1', 'PHASE_2');

-- CreateEnum
CREATE TYPE "PhaseChangeReason" AS ENUM ('WEIGHT', 'SPACE');

-- CreateEnum
CREATE TYPE "RawMaterialType" AS ENUM ('PROTEIN', 'ENERGY', 'NUCLEUS', 'ADDITIVE', 'MINERAL');

-- CreateEnum
CREATE TYPE "FormulaStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('COMPLETE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "HealthTaskType" AS ENUM ('TAIL_DOCKING', 'TOOTH_CLIPPING', 'CASTRATION', 'IRON_INJECTION', 'VACCINATION');

-- CreateEnum
CREATE TYPE "VaccinationRoute" AS ENUM ('IM', 'SC', 'ORAL');

-- CreateEnum
CREATE TYPE "DiagnosisType" AS ENUM ('DIARRHEA', 'ARTHRITIS', 'PNEUMONIA', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PIGLETS_OVERDUE_WEANING', 'SOW_STOCK_NEGATIVE', 'SOW_ZERO_PIGLETS_NO_WEANING', 'FARROWING_LONG_DURATION', 'LOW_BIRTH_WEIGHT', 'GESTATION_DAYS_OUT_OF_RANGE', 'SOW_OVERDUE_FARROWING', 'WITHDRAWAL_PERIOD_NEAR_WEANING', 'PEAK_FARROWINGS_PROJECTED', 'SEMEN_DOSE_EXPIRED', 'BATCH_REACHED_TRANSFER_WEIGHT', 'PEN_OVER_CAPACITY', 'NO_PENS_AVAILABLE', 'FINISHED_STOCK_BELOW_MIN', 'RAW_MATERIAL_BELOW_MIN', 'MYCOTOXIN_LIMIT_EXCEEDED', 'PROJECTED_SHORTAGE_60_DAYS', 'BATCH_NOT_FED', 'HEALTH_TASK_OVERDUE', 'WITHDRAWAL_PERIOD_NEAR_SALE', 'STOCK_ADJUSTMENT_PENDING', 'FORMULA_PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'WHATSAPP', 'BOTH');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PRODUCED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('GESTATION', 'MATERNITY', 'NURSERY', 'GROWING', 'BAL', 'OTHER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "farmName" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "phoneNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "language" "Language" NOT NULL DEFAULT 'ES',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "farm_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" "LocationType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "farm_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identCode" TEXT NOT NULL,
    "breed" TEXT,
    "birthDate" TIMESTAMP(3),
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentParityCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boars" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identCode" TEXT NOT NULL,
    "breed" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semen_doses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "boarId" TEXT,
    "doseCode" TEXT NOT NULL,
    "elaborationDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semen_doses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "boarId" TEXT,
    "semenDoseId" TEXT,
    "serviceBatchId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "durationMinutes" INTEGER,
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregnancy_checks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "serviceEventId" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL,
    "method" "PregnancyCheckMethod" NOT NULL,
    "result" "PregnancyCheckResult" NOT NULL,
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pregnancy_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heat_repeats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "serviceEventId" TEXT,
    "repeatDate" TIMESTAMP(3) NOT NULL,
    "cause" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heat_repeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abortion_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "serviceEventId" TEXT,
    "abortionDate" TIMESTAMP(3) NOT NULL,
    "cause" TEXT,
    "vetDiagnosis" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abortion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sow_discards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "discardDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "destination" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sow_discards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farrowing_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "serviceEventId" TEXT,
    "farrowingType" "FarrowingType" NOT NULL DEFAULT 'NORMAL',
    "startDatetime" TIMESTAMP(3) NOT NULL,
    "endDatetime" TIMESTAMP(3),
    "gestationDays" INTEGER,
    "durationMinutes" INTEGER,
    "bornAlive" INTEGER NOT NULL,
    "bornDead" INTEGER NOT NULL DEFAULT 0,
    "mummified" INTEGER NOT NULL DEFAULT 0,
    "totalBorn" INTEGER NOT NULL,
    "femalesBornAlive" INTEGER,
    "malesBornAlive" INTEGER,
    "lowViabilityCount" INTEGER NOT NULL DEFAULT 0,
    "totalLitterWeightKg" DECIMAL(8,3) NOT NULL,
    "avgPigletWeightKg" DECIMAL(8,3),
    "penId" TEXT,
    "sowWeightKg" DECIMAL(8,2),
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farrowing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piglets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farrowingId" TEXT NOT NULL,
    "identCode" TEXT,
    "identType" "PigletIdentType",
    "sex" "PigletSex",
    "weightKg" DECIMAL(6,3),
    "status" "PigletStatus" NOT NULL DEFAULT 'VIABLE',
    "birthDate" TIMESTAMP(3) NOT NULL,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piglets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piglet_deaths" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farrowingId" TEXT NOT NULL,
    "pigletId" TEXT,
    "deathDatetime" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "ageAtDeathDays" INTEGER,
    "cause" "PigletDeathCause" NOT NULL,
    "employeeId" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piglet_deaths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piglet_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piglet_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foster_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "penLocation" TEXT,
    "receiveDate" TIMESTAMP(3) NOT NULL,
    "avgAgeAtFosterDays" DECIMAL(5,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foster_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foster_donations" (
    "id" TEXT NOT NULL,
    "fosterEventId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pigletAgeDays" INTEGER NOT NULL,

    CONSTRAINT "foster_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weaning_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farrowingId" TEXT NOT NULL,
    "weaningDate" TIMESTAMP(3) NOT NULL,
    "lactationDays" INTEGER NOT NULL,
    "pigletsAvailable" INTEGER NOT NULL,
    "lastMinuteDeaths" INTEGER NOT NULL DEFAULT 0,
    "lastMinuteReceived" INTEGER NOT NULL DEFAULT 0,
    "lastMinuteDonated" INTEGER NOT NULL DEFAULT 0,
    "pigletsWeaned" INTEGER NOT NULL,
    "totalLitterWeightKg" DECIMAL(8,3) NOT NULL,
    "avgPigletWeightKg" DECIMAL(8,3) NOT NULL,
    "nurseryBatchId" TEXT,
    "sowDestination" "SowDisposalDestination" NOT NULL DEFAULT 'GESTATION',
    "bodyConditionScore" "BodyConditionScore",
    "sowWeightKg" DECIMAL(8,2),
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weaning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farrowingId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "correctStock" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursery_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "phase" "NurseryPhase" NOT NULL DEFAULT 'PHASE_1',
    "entryDate" TIMESTAMP(3) NOT NULL,
    "currentCount" INTEGER NOT NULL,
    "penId" TEXT,
    "currentWeightKg" DECIMAL(10,3),
    "avgWeightKg" DECIMAL(8,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursery_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nurseryBatchId" TEXT,
    "growingBatchId" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "totalWeightKg" DECIMAL(10,3) NOT NULL,
    "animalCount" INTEGER NOT NULL,
    "avgWeightKg" DECIMAL(8,3) NOT NULL,
    "dailyGainKg" DECIMAL(6,3),
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_changes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nurseryBatchId" TEXT NOT NULL,
    "fromPhase" "NurseryPhase" NOT NULL,
    "toPhase" "NurseryPhase" NOT NULL,
    "changeDate" TIMESTAMP(3) NOT NULL,
    "reason" "PhaseChangeReason" NOT NULL,
    "triggerWeightKg" DECIMAL(8,3),
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growing_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "nurseryBatchId" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "entryWeightKg" DECIMAL(10,3) NOT NULL,
    "currentCount" INTEGER NOT NULL,
    "penId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growing_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nurseryBatchId" TEXT,
    "growingBatchId" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "animalCount" INTEGER NOT NULL,
    "totalWeightKg" DECIMAL(10,3) NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "buyerName" TEXT,
    "transferGuide" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "feed_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedTypeId" TEXT NOT NULL,
    "farrowingId" TEXT,
    "nurseryBatchId" TEXT,
    "growingBatchId" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "quantityKg" DECIMAL(10,3) NOT NULL,
    "employeeId" TEXT,
    "isSynced" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialType" "RawMaterialType" NOT NULL,
    "supplierId" TEXT,
    "currentStockKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStockKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_lots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "remainingKg" DECIMAL(12,3) NOT NULL,
    "pricePerKg" DECIMAL(10,4) NOT NULL,
    "supplierId" TEXT,
    "invoiceNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "crudProteinPct" DECIMAL(6,3),
    "metabolizableEnergyKcal" DECIMAL(8,2),
    "lysinePct" DECIMAL(6,3),
    "methioninePct" DECIMAL(6,3),
    "calciumPct" DECIMAL(6,3),
    "phosphorusPct" DECIMAL(6,3),
    "moisturePct" DECIMAL(6,3),
    "mycotoxinPpb" DECIMAL(10,2),
    "techDataSheetUrl" TEXT,
    "aiExtractionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_material_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "FormulaStatus" NOT NULL DEFAULT 'INACTIVE',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "totalProteinPct" DECIMAL(6,3),
    "totalEnergyKcal" DECIMAL(8,2),
    "totalLysinePct" DECIMAL(6,3),
    "totalMethioninePct" DECIMAL(6,3),
    "totalCalciumPct" DECIMAL(6,3),
    "totalPhosphorusPct" DECIMAL(6,3),
    "totalMoisturePct" DECIMAL(6,3),
    "totalMycotoxinPpb" DECIMAL(10,2),
    "aiSuggestionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formula_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_ingredients" (
    "id" TEXT NOT NULL,
    "formulaVersionId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "inclusionPct" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "formula_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutritional_targets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedTypeId" TEXT NOT NULL,
    "minProteinPct" DECIMAL(6,3),
    "minEnergyKcal" DECIMAL(8,2),
    "minLysinePct" DECIMAL(6,3),
    "minMethioninePct" DECIMAL(6,3),
    "minCalciumPct" DECIMAL(6,3),
    "minPhosphorusPct" DECIMAL(6,3),
    "maxMycotoxinPpb" DECIMAL(10,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutritional_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bal_production_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formulaVersionId" TEXT NOT NULL,
    "orderedById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PENDING',
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "producedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bal_production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_stocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedTypeId" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "batchQuantityKg" DECIMAL(12,3) NOT NULL,
    "currentStockKg" DECIMAL(12,3) NOT NULL,
    "minStockDays" INTEGER NOT NULL DEFAULT 7,
    "producedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finished_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruc" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "totalAmount" DECIMAL(12,2),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "pricePerKg" DECIMAL(10,4),
    "totalAmount" DECIMAL(12,2),

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "supplierId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "invoiceNumber" TEXT,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'COMPLETE',
    "receivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "rawMaterialLotId" TEXT,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "pricePerKg" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "feedTypeId" TEXT,
    "quantityKg" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "cedula" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "position" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "baseSalaryGs" DECIMAL(14,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT true,
    "hoursWorked" DECIMAL(4,2),
    "notes" TEXT,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "leaveType" TEXT NOT NULL,
    "approvedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "baseSalaryGs" DECIMAL(14,0) NOT NULL,
    "bonusesGs" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "deductionsGs" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "ipsEmployee" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "ipsEmployer" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "netAmountGs" DECIMAL(14,0) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "amountGs" DECIMAL(14,0) NOT NULL,
    "category" TEXT NOT NULL,
    "batchSaleId" TEXT,
    "invoiceNumber" TEXT,
    "buyerName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amountGs" DECIMAL(14,0) NOT NULL,
    "category" TEXT NOT NULL,
    "supplierId" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "defaultDoseMl" DECIMAL(8,3),
    "withdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_stocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "lotCode" TEXT,
    "expiryDate" TIMESTAMP(3),
    "quantityMl" DECIMAL(10,3) NOT NULL,
    "currentQty" DECIMAL(10,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_protocol_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tailDockingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tailDockingDayOfLife" INTEGER NOT NULL DEFAULT 1,
    "toothClippingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "toothClippingDayOfLife" INTEGER NOT NULL DEFAULT 1,
    "castrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "castrationDayOfLife" INTEGER NOT NULL DEFAULT 7,
    "ironInjectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ironDayOfLife" INTEGER NOT NULL DEFAULT 3,
    "ironDoseMl" DECIMAL(6,3) NOT NULL DEFAULT 1.0,
    "ironMedicineId" TEXT,

    CONSTRAINT "health_protocol_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_protocol_tasks" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "taskType" "HealthTaskType" NOT NULL DEFAULT 'VACCINATION',
    "taskName" TEXT NOT NULL,
    "medicineId" TEXT,
    "dayOfLife" INTEGER NOT NULL,
    "doseMl" DECIMAL(8,3),
    "route" "VaccinationRoute",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "health_protocol_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farrowingId" TEXT NOT NULL,
    "protocolTaskId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_task_completions" (
    "id" TEXT NOT NULL,
    "healthTaskId" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL,
    "ageAtApplicationDays" INTEGER,
    "quantityApplied" INTEGER NOT NULL,
    "productLot" TEXT,
    "productExpiry" TIMESTAMP(3),
    "medicineStockId" TEXT,
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curative_treatments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farrowingId" TEXT,
    "pigletId" TEXT,
    "diagnosisType" "DiagnosisType" NOT NULL,
    "diagnosisNotes" TEXT,
    "medicineId" TEXT NOT NULL,
    "doseMl" DECIMAL(8,3) NOT NULL,
    "animalsAffected" INTEGER NOT NULL,
    "treatmentDays" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "withdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curative_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pigletId" TEXT,
    "farrowingId" TEXT,
    "medicineId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "withdrawalDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "withdrawal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "WhatsAppSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "context" JSONB NOT NULL DEFAULT '{}',
    "currentStep" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "transcript" TEXT,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'BOTH',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "farm_locations_tenantId_idx" ON "farm_locations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "farm_locations_tenantId_name_key" ON "farm_locations"("tenantId", "name");

-- CreateIndex
CREATE INDEX "pens_tenantId_idx" ON "pens"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "pens_tenantId_locationId_number_key" ON "pens"("tenantId", "locationId", "number");

-- CreateIndex
CREATE INDEX "sows_tenantId_idx" ON "sows"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sows_tenantId_identCode_key" ON "sows"("tenantId", "identCode");

-- CreateIndex
CREATE INDEX "boars_tenantId_idx" ON "boars"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "boars_tenantId_identCode_key" ON "boars"("tenantId", "identCode");

-- CreateIndex
CREATE INDEX "semen_doses_tenantId_idx" ON "semen_doses"("tenantId");

-- CreateIndex
CREATE INDEX "service_batches_tenantId_idx" ON "service_batches"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "service_batches_tenantId_weekLabel_key" ON "service_batches"("tenantId", "weekLabel");

-- CreateIndex
CREATE INDEX "service_events_tenantId_sowId_idx" ON "service_events"("tenantId", "sowId");

-- CreateIndex
CREATE INDEX "service_events_tenantId_serviceDate_idx" ON "service_events"("tenantId", "serviceDate");

-- CreateIndex
CREATE INDEX "pregnancy_checks_tenantId_idx" ON "pregnancy_checks"("tenantId");

-- CreateIndex
CREATE INDEX "heat_repeats_tenantId_idx" ON "heat_repeats"("tenantId");

-- CreateIndex
CREATE INDEX "abortion_events_tenantId_idx" ON "abortion_events"("tenantId");

-- CreateIndex
CREATE INDEX "sow_discards_tenantId_idx" ON "sow_discards"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "farrowing_events_serviceEventId_key" ON "farrowing_events"("serviceEventId");

-- CreateIndex
CREATE INDEX "farrowing_events_tenantId_sowId_idx" ON "farrowing_events"("tenantId", "sowId");

-- CreateIndex
CREATE INDEX "farrowing_events_tenantId_startDatetime_idx" ON "farrowing_events"("tenantId", "startDatetime");

-- CreateIndex
CREATE INDEX "piglets_tenantId_farrowingId_idx" ON "piglets"("tenantId", "farrowingId");

-- CreateIndex
CREATE UNIQUE INDEX "piglets_tenantId_identCode_key" ON "piglets"("tenantId", "identCode");

-- CreateIndex
CREATE INDEX "piglet_deaths_tenantId_farrowingId_idx" ON "piglet_deaths"("tenantId", "farrowingId");

-- CreateIndex
CREATE INDEX "piglet_movements_tenantId_idx" ON "piglet_movements"("tenantId");

-- CreateIndex
CREATE INDEX "foster_events_tenantId_idx" ON "foster_events"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "weaning_events_farrowingId_key" ON "weaning_events"("farrowingId");

-- CreateIndex
CREATE INDEX "weaning_events_tenantId_idx" ON "weaning_events"("tenantId");

-- CreateIndex
CREATE INDEX "stock_adjustment_requests_tenantId_status_idx" ON "stock_adjustment_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "nursery_batches_tenantId_idx" ON "nursery_batches"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "nursery_batches_tenantId_batchCode_key" ON "nursery_batches"("tenantId", "batchCode");

-- CreateIndex
CREATE INDEX "weight_records_tenantId_idx" ON "weight_records"("tenantId");

-- CreateIndex
CREATE INDEX "phase_changes_tenantId_idx" ON "phase_changes"("tenantId");

-- CreateIndex
CREATE INDEX "growing_batches_tenantId_idx" ON "growing_batches"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "growing_batches_tenantId_batchCode_key" ON "growing_batches"("tenantId", "batchCode");

-- CreateIndex
CREATE INDEX "batch_sales_tenantId_idx" ON "batch_sales"("tenantId");

-- CreateIndex
CREATE INDEX "feed_types_tenantId_idx" ON "feed_types"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "feed_types_tenantId_phase_key" ON "feed_types"("tenantId", "phase");

-- CreateIndex
CREATE INDEX "feed_records_tenantId_recordDate_idx" ON "feed_records"("tenantId", "recordDate");

-- CreateIndex
CREATE INDEX "raw_materials_tenantId_idx" ON "raw_materials"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "raw_materials_tenantId_name_key" ON "raw_materials"("tenantId", "name");

-- CreateIndex
CREATE INDEX "raw_material_lots_tenantId_rawMaterialId_idx" ON "raw_material_lots"("tenantId", "rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_lots_rawMaterialId_lotCode_key" ON "raw_material_lots"("rawMaterialId", "lotCode");

-- CreateIndex
CREATE INDEX "formulas_tenantId_idx" ON "formulas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "formulas_tenantId_feedTypeId_key" ON "formulas"("tenantId", "feedTypeId");

-- CreateIndex
CREATE INDEX "formula_versions_tenantId_idx" ON "formula_versions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "formula_versions_formulaId_versionNumber_key" ON "formula_versions"("formulaId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "formula_ingredients_formulaVersionId_rawMaterialId_key" ON "formula_ingredients"("formulaVersionId", "rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "nutritional_targets_tenantId_feedTypeId_key" ON "nutritional_targets"("tenantId", "feedTypeId");

-- CreateIndex
CREATE INDEX "bal_production_orders_tenantId_status_idx" ON "bal_production_orders"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "finished_stocks_productionOrderId_key" ON "finished_stocks"("productionOrderId");

-- CreateIndex
CREATE INDEX "finished_stocks_tenantId_feedTypeId_idx" ON "finished_stocks"("tenantId", "feedTypeId");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenantId_name_key" ON "suppliers"("tenantId", "name");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_status_idx" ON "purchase_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "goods_receipts_tenantId_idx" ON "goods_receipts"("tenantId");

-- CreateIndex
CREATE INDEX "transfers_tenantId_idx" ON "transfers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_tenantId_idx" ON "employees"("tenantId");

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_idx" ON "attendance_records"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employeeId_workDate_key" ON "attendance_records"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "leave_records_tenantId_idx" ON "leave_records"("tenantId");

-- CreateIndex
CREATE INDEX "payroll_records_tenantId_idx" ON "payroll_records"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_batchSaleId_key" ON "sales"("batchSaleId");

-- CreateIndex
CREATE INDEX "sales_tenantId_saleDate_idx" ON "sales"("tenantId", "saleDate");

-- CreateIndex
CREATE INDEX "expenses_tenantId_expenseDate_idx" ON "expenses"("tenantId", "expenseDate");

-- CreateIndex
CREATE INDEX "medicines_tenantId_idx" ON "medicines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_tenantId_name_key" ON "medicines"("tenantId", "name");

-- CreateIndex
CREATE INDEX "medicine_stocks_tenantId_idx" ON "medicine_stocks"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "health_protocol_configs_tenantId_key" ON "health_protocol_configs"("tenantId");

-- CreateIndex
CREATE INDEX "health_tasks_tenantId_isCompleted_dueDate_idx" ON "health_tasks"("tenantId", "isCompleted", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "health_task_completions_healthTaskId_key" ON "health_task_completions"("healthTaskId");

-- CreateIndex
CREATE INDEX "curative_treatments_tenantId_idx" ON "curative_treatments"("tenantId");

-- CreateIndex
CREATE INDEX "withdrawal_periods_tenantId_isActive_endDate_idx" ON "withdrawal_periods"("tenantId", "isActive", "endDate");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_phoneNumber_status_idx" ON "whatsapp_sessions"("phoneNumber", "status");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_tenantId_idx" ON "whatsapp_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_sessionId_idx" ON "whatsapp_messages"("sessionId");

-- CreateIndex
CREATE INDEX "alerts_tenantId_isResolved_createdAt_idx" ON "alerts"("tenantId", "isResolved", "createdAt");

-- CreateIndex
CREATE INDEX "alerts_tenantId_alertType_idx" ON "alerts"("tenantId", "alertType");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pens" ADD CONSTRAINT "pens_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "farm_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semen_doses" ADD CONSTRAINT "semen_doses_boarId_fkey" FOREIGN KEY ("boarId") REFERENCES "boars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_boarId_fkey" FOREIGN KEY ("boarId") REFERENCES "boars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_semenDoseId_fkey" FOREIGN KEY ("semenDoseId") REFERENCES "semen_doses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_serviceBatchId_fkey" FOREIGN KEY ("serviceBatchId") REFERENCES "service_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_checks" ADD CONSTRAINT "pregnancy_checks_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_checks" ADD CONSTRAINT "pregnancy_checks_serviceEventId_fkey" FOREIGN KEY ("serviceEventId") REFERENCES "service_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heat_repeats" ADD CONSTRAINT "heat_repeats_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abortion_events" ADD CONSTRAINT "abortion_events_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sow_discards" ADD CONSTRAINT "sow_discards_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farrowing_events" ADD CONSTRAINT "farrowing_events_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farrowing_events" ADD CONSTRAINT "farrowing_events_serviceEventId_fkey" FOREIGN KEY ("serviceEventId") REFERENCES "service_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farrowing_events" ADD CONSTRAINT "farrowing_events_penId_fkey" FOREIGN KEY ("penId") REFERENCES "pens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piglets" ADD CONSTRAINT "piglets_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piglet_deaths" ADD CONSTRAINT "piglet_deaths_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piglet_deaths" ADD CONSTRAINT "piglet_deaths_pigletId_fkey" FOREIGN KEY ("pigletId") REFERENCES "piglets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piglet_movements" ADD CONSTRAINT "piglet_movements_originId_fkey" FOREIGN KEY ("originId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piglet_movements" ADD CONSTRAINT "piglet_movements_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foster_events" ADD CONSTRAINT "foster_events_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foster_donations" ADD CONSTRAINT "foster_donations_fosterEventId_fkey" FOREIGN KEY ("fosterEventId") REFERENCES "foster_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foster_donations" ADD CONSTRAINT "foster_donations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weaning_events" ADD CONSTRAINT "weaning_events_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weaning_events" ADD CONSTRAINT "weaning_events_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_requests" ADD CONSTRAINT "stock_adjustment_requests_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_requests" ADD CONSTRAINT "stock_adjustment_requests_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_batches" ADD CONSTRAINT "nursery_batches_penId_fkey" FOREIGN KEY ("penId") REFERENCES "pens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_changes" ADD CONSTRAINT "phase_changes_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growing_batches" ADD CONSTRAINT "growing_batches_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growing_batches" ADD CONSTRAINT "growing_batches_penId_fkey" FOREIGN KEY ("penId") REFERENCES "pens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_sales" ADD CONSTRAINT "batch_sales_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_sales" ADD CONSTRAINT "batch_sales_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_lots" ADD CONSTRAINT "raw_material_lots_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulas" ADD CONSTRAINT "formulas_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_versions" ADD CONSTRAINT "formula_versions_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_versions" ADD CONSTRAINT "formula_versions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_ingredients" ADD CONSTRAINT "formula_ingredients_formulaVersionId_fkey" FOREIGN KEY ("formulaVersionId") REFERENCES "formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_ingredients" ADD CONSTRAINT "formula_ingredients_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutritional_targets" ADD CONSTRAINT "nutritional_targets_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bal_production_orders" ADD CONSTRAINT "bal_production_orders_formulaVersionId_fkey" FOREIGN KEY ("formulaVersionId") REFERENCES "formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_stocks" ADD CONSTRAINT "finished_stocks_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_stocks" ADD CONSTRAINT "finished_stocks_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "bal_production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_rawMaterialLotId_fkey" FOREIGN KEY ("rawMaterialLotId") REFERENCES "raw_material_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_stocks" ADD CONSTRAINT "medicine_stocks_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_protocol_tasks" ADD CONSTRAINT "health_protocol_tasks_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "health_protocol_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_protocol_tasks" ADD CONSTRAINT "health_protocol_tasks_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_tasks" ADD CONSTRAINT "health_tasks_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_tasks" ADD CONSTRAINT "health_tasks_protocolTaskId_fkey" FOREIGN KEY ("protocolTaskId") REFERENCES "health_protocol_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_task_completions" ADD CONSTRAINT "health_task_completions_healthTaskId_fkey" FOREIGN KEY ("healthTaskId") REFERENCES "health_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curative_treatments" ADD CONSTRAINT "curative_treatments_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curative_treatments" ADD CONSTRAINT "curative_treatments_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curative_treatments" ADD CONSTRAINT "curative_treatments_pigletId_fkey" FOREIGN KEY ("pigletId") REFERENCES "piglets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_pigletId_fkey" FOREIGN KEY ("pigletId") REFERENCES "piglets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "curative_treatments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "whatsapp_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
