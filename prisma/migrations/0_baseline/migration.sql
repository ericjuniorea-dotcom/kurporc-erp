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
CREATE TYPE "HealthTaskType" AS ENUM ('TAIL_DOCKING', 'TOOTH_CLIPPING', 'CASTRATION', 'IRON_INJECTION', 'VACCINATION', 'CLEANING', 'OTHER_PROCEDURE');

-- CreateEnum
CREATE TYPE "VaccinationRoute" AS ENUM ('IM', 'SC', 'ORAL');

-- CreateEnum
CREATE TYPE "DiagnosisType" AS ENUM ('DIARRHEA', 'ARTHRITIS', 'PNEUMONIA', 'OTHER');

-- CreateEnum
CREATE TYPE "EstadoTratamiento" AS ENUM ('ACTIVO', 'EN_SEGUIMIENTO', 'FINALIZADO', 'ABANDONADO');

-- CreateEnum
CREATE TYPE "ProcedimientoMaternidadTipo" AS ENUM ('DESCOLMILLADO', 'CORTE_COLA', 'CORTE_OMBLIGO', 'HIERRO', 'CASTRACION');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PIGLETS_OVERDUE_WEANING', 'SOW_STOCK_NEGATIVE', 'SOW_ZERO_PIGLETS_NO_WEANING', 'FARROWING_LONG_DURATION', 'LOW_BIRTH_WEIGHT', 'GESTATION_DAYS_OUT_OF_RANGE', 'SOW_OVERDUE_FARROWING', 'WITHDRAWAL_PERIOD_NEAR_WEANING', 'PEAK_FARROWINGS_PROJECTED', 'SEMEN_DOSE_EXPIRED', 'HEAT_REPEAT_DISCARD', 'LOW_CONCEPTION_RATE', 'BATCH_REACHED_TRANSFER_WEIGHT', 'PEN_OVER_CAPACITY', 'NO_PENS_AVAILABLE', 'FINISHED_STOCK_BELOW_MIN', 'RAW_MATERIAL_BELOW_MIN', 'MYCOTOXIN_LIMIT_EXCEEDED', 'PROJECTED_SHORTAGE_60_DAYS', 'BATCH_NOT_FED', 'HEALTH_TASK_OVERDUE', 'WITHDRAWAL_PERIOD_NEAR_SALE', 'STOCK_ADJUSTMENT_PENDING', 'FORMULA_PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SowPlantelState" AS ENUM ('QUARANTINE', 'REPLACEMENT_DEVELOPING', 'REPLACEMENT_READY', 'MATED', 'PREGNANT', 'FARROWING', 'LACTATING', 'EMPTY', 'CULLED', 'DEAD');

-- CreateEnum
CREATE TYPE "BoarPlantelState" AS ENUM ('QUARANTINE', 'ACTIVE', 'RESTING', 'CULLED', 'DEAD');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'WHATSAPP', 'BOTH');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PRODUCED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('GESTATION', 'MATERNITY', 'NURSERY', 'GROWING', 'BAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TipoGenetico" AS ENUM ('RAZA_PURA', 'HIBRIDA_F1', 'SINTETICA', 'CRUZA_INTERNA');

-- CreateEnum
CREATE TYPE "FuncionGenetica" AS ENUM ('MATERNA', 'PATERNA');

-- CreateEnum
CREATE TYPE "Paridad" AS ENUM ('NULIPARA', 'MULTIPARA', 'AMBAS');

-- CreateEnum
CREATE TYPE "SujetoAplicacion" AS ENUM ('LECHON', 'HEMBRA');

-- CreateEnum
CREATE TYPE "MarketplacePedidoEstado" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MarketplaceCategoria" AS ENUM ('VACUNA', 'MEDICAMENTO', 'INSUMO', 'ALIMENTO', 'EQUIPAMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "CategoriaProducto" AS ENUM ('VACUNA', 'SUPLEMENTO', 'MEDICAMENTO', 'MATERIA_PRIMA', 'BALANCEADO', 'EQUIPAMIENTO');

-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('DOSIS', 'ML', 'KG', 'UNIDAD', 'SACO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "OrigenMovimiento" AS ENUM ('VACUNACION', 'TRATAMIENTO', 'MATERNIDAD', 'PRODUCCION', 'ALIMENTACION', 'COMPRA', 'AJUSTE_MANUAL');

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
    "erpCode" TEXT,
    "caravanaCode" TEXT,
    "tattooCode" TEXT,
    "rfidChip" TEXT,
    "photoUrl" TEXT,
    "geneticLine" TEXT,
    "entryWeightKg" DECIMAL(8,2),
    "currentWeightKg" DECIMAL(8,2),
    "sourceProvider" TEXT,
    "purchasePriceGs" DECIMAL(14,0),
    "damCodeOrigin" TEXT,
    "sireCodeOrigin" TEXT,
    "galponAssigned" TEXT,
    "corralAssigned" TEXT,
    "plantelState" "SowPlantelState",
    "plantelNotes" TEXT,

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
    "erpCode" TEXT,
    "caravanaCode" TEXT,
    "tattooCode" TEXT,
    "rfidChip" TEXT,
    "photoUrl" TEXT,
    "geneticLine" TEXT,
    "birthDate" TIMESTAMP(3),
    "entryDate" TIMESTAMP(3),
    "entryWeightKg" DECIMAL(8,2),
    "sourceProvider" TEXT,
    "purchasePriceGs" DECIMAL(14,0),
    "galponAssigned" TEXT,
    "corralAssigned" TEXT,
    "plantelState" "BoarPlantelState",
    "plantelNotes" TEXT,

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
CREATE TABLE "config_metas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "kpiKey" TEXT NOT NULL,
    "valor" DECIMAL(10,3) NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_metas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_genetica" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresa" TEXT,
    "tipoGenetico" "TipoGenetico" NOT NULL,
    "funcion" "FuncionGenetica" NOT NULL,
    "composicionRacial" TEXT,
    "metaNacidosVivos" DECIMAL(6,2),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_genetica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_vacunas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "nombreVacuna" TEXT NOT NULL,
    "marcaComercial" TEXT NOT NULL,
    "laboratorio" TEXT NOT NULL,
    "principioActivo" TEXT NOT NULL,
    "enfermedadObjetivo" TEXT,
    "viaAplicacion" TEXT NOT NULL,
    "dosisMl" DECIMAL(8,3) NOT NULL,
    "momentoAplicacion" TEXT NOT NULL,
    "refuerzoDias" INTEGER,
    "paisProcedencia" TEXT NOT NULL,
    "tempConservacion" TEXT NOT NULL,
    "diasAlertaVto" INTEGER NOT NULL DEFAULT 30,
    "loteActual" TEXT,
    "fechaVencimientoLote" TIMESTAMP(3),
    "stockDosis" INTEGER,
    "stockMinimoAlerta" INTEGER,
    "fichaTecnicaUrl" TEXT,
    "obligatoria" BOOLEAN NOT NULL DEFAULT false,
    "diasEsperaServicio" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "paridad" "Paridad" NOT NULL DEFAULT 'AMBAS',
    "diaGestacion" INTEGER,
    "ordenDosis" INTEGER NOT NULL DEFAULT 1,
    "grupoMezclaId" TEXT,
    "sujeto" "SujetoAplicacion",
    "diaReferencia" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_vacunas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_procesos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "procesoKey" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_procesos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_alertas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "eventoKey" TEXT NOT NULL,
    "umbral" DECIMAL(10,3),
    "canales" TEXT[],
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "gravedad" TEXT NOT NULL DEFAULT 'WARNING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT,
    "boarId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "moduleSource" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_semen_lots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "geneticLine" TEXT NOT NULL,
    "donorBoarCode" TEXT NOT NULL,
    "originFarm" TEXT NOT NULL,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "totalDoses" INTEGER NOT NULL,
    "availableDoses" INTEGER NOT NULL,
    "pricePerDoseGs" DECIMAL(14,0) NOT NULL,
    "certUrl" TEXT,
    "observations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_semen_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
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
    "reason" TEXT NOT NULL DEFAULT '',
    "destination" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoria" TEXT,
    "motivosEspecificos" TEXT[],
    "motivoPrincipal" TEXT,
    "tipoDescarte" TEXT,
    "pesoKg" DECIMAL(8,2),
    "condicionCorporal" INTEGER,
    "estadoSanitario" TEXT,
    "estadoReproductivo" TEXT,
    "estadoProductivo" TEXT,
    "numeroParto" INTEGER,
    "diasUltimoParto" INTEGER,
    "diasUltimoServicio" INTEGER,
    "numeroServicios" INTEGER,
    "lechonesDestetados" INTEGER,
    "diagnostico" TEXT,
    "veterinario" TEXT,
    "observacionesClinicas" TEXT,
    "observaciones" TEXT,
    "responsableAutoriza" TEXT,

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
    "sitio" TEXT,
    "procedencia" TEXT NOT NULL DEFAULT 'RECRIA_PROPIA',
    "avgAgeAtEntryDays" INTEGER,
    "targetWeightKg" DECIMAL(8,2),
    "employeeId" TEXT,
    "observations" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,

    CONSTRAINT "growing_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growing_deaths" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "growingBatchId" TEXT NOT NULL,
    "deathDate" TIMESTAMP(3) NOT NULL,
    "deathTime" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "cause" TEXT NOT NULL,
    "employeeId" TEXT,
    "estimatedWeightKg" DECIMAL(8,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growing_deaths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growing_transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "targetBatchId" TEXT,
    "targetSite" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "totalWeightKg" DECIMAL(10,3),
    "avgWeightKg" DECIMAL(8,3),
    "reason" TEXT NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growing_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growing_other_exits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "growingBatchId" TEXT NOT NULL,
    "exitType" TEXT NOT NULL,
    "exitDate" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "estimatedWeightKg" DECIMAL(8,2),
    "reason" TEXT NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growing_other_exits_pkey" PRIMARY KEY ("id")
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
    "productoBalanceadoId" TEXT,

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
CREATE TABLE "lotes_inventario_nutricion" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "supplierId" TEXT,
    "pricePerKg" DECIMAL(10,4),
    "invoiceNumber" TEXT,
    "techDataSheetUrl" TEXT,
    "aiExtractionNotes" TEXT,
    "crudProteinPct" DECIMAL(6,3),
    "metabolizableEnergyKcal" DECIMAL(8,2),
    "lysinePct" DECIMAL(6,3),
    "methioninePct" DECIMAL(6,3),
    "calciumPct" DECIMAL(6,3),
    "phosphorusPct" DECIMAL(6,3),
    "moisturePct" DECIMAL(6,3),
    "mycotoxinPpb" DECIMAL(10,2),

    CONSTRAINT "lotes_inventario_nutricion_pkey" PRIMARY KEY ("id")
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
    "loteInventarioId" TEXT,

    CONSTRAINT "bal_production_orders_pkey" PRIMARY KEY ("id")
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
    "productoId" TEXT NOT NULL,
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
    "loteInventarioId" TEXT,
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
    "cargo" TEXT,
    "category" TEXT,
    "position" TEXT,
    "sector" TEXT,
    "iniciales" TEXT,
    "colorBg" TEXT,
    "colorBorder" TEXT,
    "colorText" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "baseSalaryGs" DECIMAL(14,0) NOT NULL DEFAULT 0,
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
    "assignedToId" TEXT,
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
    "sowId" TEXT,
    "diagnosisType" "DiagnosisType" NOT NULL,
    "diagnosisNotes" TEXT,
    "motivoClinico" TEXT,
    "medicineId" TEXT NOT NULL,
    "doseMl" DECIMAL(8,3) NOT NULL,
    "animalsAffected" INTEGER NOT NULL,
    "treatmentDays" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "withdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoTratamiento" NOT NULL DEFAULT 'ACTIVO',
    "fechaSeguimiento" TIMESTAMP(3),
    "respuestaSeguimiento" TEXT,
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
    "sowId" TEXT,
    "medicineId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "withdrawalDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "withdrawal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedimientos_maternidad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farrowingId" TEXT NOT NULL,
    "procedimiento" "ProcedimientoMaternidadTipo" NOT NULL,
    "cantidadLechonesProcesados" INTEGER NOT NULL,
    "edadDiasAlProcedimiento" INTEGER NOT NULL,
    "observacionesTecnica" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "responsableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procedimientos_maternidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "necropsias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sowId" TEXT,
    "boarId" TEXT,
    "farrowingId" TEXT,
    "pigletId" TEXT,
    "causaSanitariaPresunta" TEXT NOT NULL,
    "seRealizoNecropsia" BOOLEAN NOT NULL DEFAULT false,
    "hallazgos" TEXT,
    "galpon" TEXT,
    "bajaConfirmaBrote" BOOLEAN NOT NULL DEFAULT false,
    "bajaConfirmaBrotePor" TEXT,
    "bajaConfirmaBroteFecha" TIMESTAMP(3),
    "fecha" TIMESTAMP(3) NOT NULL,
    "responsableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "necropsias_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "marketplace_vendors" (
    "id" TEXT NOT NULL,
    "empresaNombre" TEXT NOT NULL,
    "ruc" TEXT,
    "contactoNombre" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "logoUrl" TEXT,
    "descripcion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_productos" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoria" "MarketplaceCategoria" NOT NULL DEFAULT 'VACUNA',
    "nombreProducto" TEXT NOT NULL,
    "descripcion" TEXT,
    "principioActivo" TEXT,
    "enfermedadObjetivo" TEXT,
    "viaAplicacion" TEXT,
    "dosisMl" DECIMAL(8,3),
    "presentacion" TEXT,
    "fichaTecnicaUrl" TEXT,
    "stockDisponible" INTEGER NOT NULL DEFAULT 0,
    "unidadMedida" TEXT NOT NULL DEFAULT 'dosis',
    "precioGs" DECIMAL(14,0) NOT NULL,
    "precioUsd" DECIMAL(10,2),
    "paisProcedencia" TEXT,
    "requiereReceta" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_pedidos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "estado" "MarketplacePedidoEstado" NOT NULL DEFAULT 'PENDIENTE',
    "totalGs" DECIMAL(14,0) NOT NULL,
    "notas" TEXT,
    "direccionEntrega" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_pedido_items" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioGs" DECIMAL(14,0) NOT NULL,

    CONSTRAINT "marketplace_pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "alcance" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "instrucciones" TEXT,
    "prioridad" TEXT NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "fechaCompletada" TIMESTAMP(3),
    "animalId" TEXT,
    "farrowingId" TEXT,
    "nurseryBatchId" TEXT,
    "growingBatchId" TEXT,
    "targetLabel" TEXT,
    "completadaPor" TEXT,
    "notas" TEXT,
    "pospuestas" INTEGER NOT NULL DEFAULT 0,
    "responsableNombre" TEXT,
    "responsableKey" TEXT,
    "generadaPor" TEXT NOT NULL DEFAULT 'sistema',
    "disparador" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacunas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "enfermedad" TEXT NOT NULL,
    "sector_destino" TEXT NOT NULL,
    "categoria" "CategoriaProducto" NOT NULL DEFAULT 'VACUNA',
    "codigo" TEXT,
    "unidadMedida" "UnidadMedida" NOT NULL DEFAULT 'DOSIS',
    "stockMinimo" INTEGER,
    "materialType" "RawMaterialType",
    "viaAplicacion" TEXT NOT NULL DEFAULT 'IM',
    "dosisMl" DECIMAL(6,2) NOT NULL DEFAULT 2,
    "intervaloRefuerzo" INTEGER,
    "criticidad" TEXT NOT NULL DEFAULT 'alta',
    "bloqueoServicio" BOOLEAN NOT NULL DEFAULT false,
    "descarteHorasApertura" INTEGER,
    "observaciones" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacunas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_vacunas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vacunaId" TEXT NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "proveedor" TEXT,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cantidadInicial" DECIMAL(12,3) NOT NULL,
    "cantidadActual" DECIMAL(12,3) NOT NULL,
    "costoUnitario" DECIMAL(12,4),
    "abierto" BOOLEAN NOT NULL DEFAULT false,
    "fechaApertura" TIMESTAMP(3),
    "abiertoPorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_vacunas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "loteId" TEXT,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "origen" "OrigenMovimiento" NOT NULL,
    "referenciaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolos_sanitarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fase" TEXT NOT NULL,
    "tipoAnimal" TEXT NOT NULL,
    "descripcion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protocolos_sanitarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolo_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "vacunaId" TEXT NOT NULL,
    "diaCiclo" INTEGER NOT NULL,
    "disparador" TEXT NOT NULL,
    "esObligatorio" BOOLEAN NOT NULL DEFAULT true,
    "bloqueoServicio" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protocolo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_vacunacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "protocoloItemId" TEXT,
    "vacunaId" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "animalId" TEXT,
    "farrowingId" TEXT,
    "nurseryBatchId" TEXT,
    "growingBatchId" TEXT,
    "targetLabel" TEXT,
    "dosisNecesarias" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "disparador" TEXT,
    "sectorAlAplicar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_vacunacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicaciones_vacunas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "loteVacunaId" TEXT,
    "vacunaId" TEXT NOT NULL,
    "dosisAplicadas" INTEGER NOT NULL,
    "fechaAplicacion" TIMESTAMP(3) NOT NULL,
    "responsable" TEXT NOT NULL,
    "observaciones" TEXT,
    "grupoAplicacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicaciones_vacunas_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "sows_tenantId_erpCode_key" ON "sows"("tenantId", "erpCode");

-- CreateIndex
CREATE INDEX "boars_tenantId_idx" ON "boars"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "boars_tenantId_identCode_key" ON "boars"("tenantId", "identCode");

-- CreateIndex
CREATE UNIQUE INDEX "boars_tenantId_erpCode_key" ON "boars"("tenantId", "erpCode");

-- CreateIndex
CREATE INDEX "semen_doses_tenantId_idx" ON "semen_doses"("tenantId");

-- CreateIndex
CREATE INDEX "config_metas_tenantId_idx" ON "config_metas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "config_metas_tenantId_modulo_kpiKey_key" ON "config_metas"("tenantId", "modulo", "kpiKey");

-- CreateIndex
CREATE INDEX "config_genetica_tenantId_idx" ON "config_genetica"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "config_genetica_tenantId_nombre_key" ON "config_genetica"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "config_vacunas_tenantId_modulo_idx" ON "config_vacunas"("tenantId", "modulo");

-- CreateIndex
CREATE INDEX "config_procesos_tenantId_idx" ON "config_procesos"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "config_procesos_tenantId_modulo_procesoKey_key" ON "config_procesos"("tenantId", "modulo", "procesoKey");

-- CreateIndex
CREATE INDEX "config_alertas_tenantId_idx" ON "config_alertas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "config_alertas_tenantId_modulo_eventoKey_key" ON "config_alertas"("tenantId", "modulo", "eventoKey");

-- CreateIndex
CREATE INDEX "animal_events_tenantId_sowId_idx" ON "animal_events"("tenantId", "sowId");

-- CreateIndex
CREATE INDEX "animal_events_tenantId_boarId_idx" ON "animal_events"("tenantId", "boarId");

-- CreateIndex
CREATE INDEX "external_semen_lots_tenantId_idx" ON "external_semen_lots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "external_semen_lots_tenantId_lotCode_key" ON "external_semen_lots"("tenantId", "lotCode");

-- CreateIndex
CREATE INDEX "service_batches_tenantId_weekLabel_idx" ON "service_batches"("tenantId", "weekLabel");

-- CreateIndex
CREATE INDEX "service_batches_tenantId_idx" ON "service_batches"("tenantId");

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
CREATE INDEX "growing_deaths_tenantId_deathDate_idx" ON "growing_deaths"("tenantId", "deathDate");

-- CreateIndex
CREATE INDEX "growing_transfers_tenantId_transferDate_idx" ON "growing_transfers"("tenantId", "transferDate");

-- CreateIndex
CREATE INDEX "growing_other_exits_tenantId_exitDate_idx" ON "growing_other_exits"("tenantId", "exitDate");

-- CreateIndex
CREATE INDEX "batch_sales_tenantId_idx" ON "batch_sales"("tenantId");

-- CreateIndex
CREATE INDEX "feed_types_tenantId_idx" ON "feed_types"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "feed_types_tenantId_phase_key" ON "feed_types"("tenantId", "phase");

-- CreateIndex
CREATE INDEX "feed_records_tenantId_recordDate_idx" ON "feed_records"("tenantId", "recordDate");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_inventario_nutricion_loteId_key" ON "lotes_inventario_nutricion"("loteId");

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
CREATE UNIQUE INDEX "bal_production_orders_loteInventarioId_key" ON "bal_production_orders"("loteInventarioId");

-- CreateIndex
CREATE INDEX "bal_production_orders_tenantId_status_idx" ON "bal_production_orders"("tenantId", "status");

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
CREATE INDEX "health_tasks_tenantId_assignedToId_idx" ON "health_tasks"("tenantId", "assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "health_task_completions_healthTaskId_key" ON "health_task_completions"("healthTaskId");

-- CreateIndex
CREATE INDEX "curative_treatments_tenantId_idx" ON "curative_treatments"("tenantId");

-- CreateIndex
CREATE INDEX "withdrawal_periods_tenantId_isActive_endDate_idx" ON "withdrawal_periods"("tenantId", "isActive", "endDate");

-- CreateIndex
CREATE INDEX "procedimientos_maternidad_tenantId_farrowingId_idx" ON "procedimientos_maternidad"("tenantId", "farrowingId");

-- CreateIndex
CREATE INDEX "necropsias_tenantId_fecha_idx" ON "necropsias"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "necropsias_tenantId_galpon_causaSanitariaPresunta_idx" ON "necropsias"("tenantId", "galpon", "causaSanitariaPresunta");

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

-- CreateIndex
CREATE INDEX "marketplace_productos_vendorId_isActive_idx" ON "marketplace_productos"("vendorId", "isActive");

-- CreateIndex
CREATE INDEX "marketplace_productos_categoria_isActive_idx" ON "marketplace_productos"("categoria", "isActive");

-- CreateIndex
CREATE INDEX "marketplace_pedidos_tenantId_estado_idx" ON "marketplace_pedidos"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "tasks_tenantId_fechaVencimiento_idx" ON "tasks"("tenantId", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "tasks_tenantId_sector_fechaVencimiento_idx" ON "tasks"("tenantId", "sector", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "tasks_tenantId_tipo_farrowingId_idx" ON "tasks"("tenantId", "tipo", "farrowingId");

-- CreateIndex
CREATE INDEX "vacunas_tenantId_idx" ON "vacunas"("tenantId");

-- CreateIndex
CREATE INDEX "vacunas_tenantId_categoria_idx" ON "vacunas"("tenantId", "categoria");

-- CreateIndex
CREATE INDEX "lotes_vacunas_tenantId_vacunaId_idx" ON "lotes_vacunas"("tenantId", "vacunaId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_tenantId_productoId_fecha_idx" ON "movimientos_inventario"("tenantId", "productoId", "fecha");

-- CreateIndex
CREATE INDEX "protocolos_sanitarios_tenantId_idx" ON "protocolos_sanitarios"("tenantId");

-- CreateIndex
CREATE INDEX "protocolo_items_tenantId_protocoloId_idx" ON "protocolo_items"("tenantId", "protocoloId");

-- CreateIndex
CREATE INDEX "eventos_vacunacion_tenantId_fecha_idx" ON "eventos_vacunacion"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "eventos_vacunacion_tenantId_vacunaId_estado_idx" ON "eventos_vacunacion"("tenantId", "vacunaId", "estado");

-- CreateIndex
CREATE INDEX "aplicaciones_vacunas_tenantId_eventoId_idx" ON "aplicaciones_vacunas"("tenantId", "eventoId");

-- CreateIndex
CREATE INDEX "aplicaciones_vacunas_tenantId_grupoAplicacionId_idx" ON "aplicaciones_vacunas"("tenantId", "grupoAplicacionId");

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
ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_boarId_fkey" FOREIGN KEY ("boarId") REFERENCES "boars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "growing_deaths" ADD CONSTRAINT "growing_deaths_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growing_transfers" ADD CONSTRAINT "growing_transfers_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "growing_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growing_transfers" ADD CONSTRAINT "growing_transfers_targetBatchId_fkey" FOREIGN KEY ("targetBatchId") REFERENCES "growing_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growing_other_exits" ADD CONSTRAINT "growing_other_exits_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_sales" ADD CONSTRAINT "batch_sales_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_sales" ADD CONSTRAINT "batch_sales_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_types" ADD CONSTRAINT "feed_types_productoBalanceadoId_fkey" FOREIGN KEY ("productoBalanceadoId") REFERENCES "vacunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_nurseryBatchId_fkey" FOREIGN KEY ("nurseryBatchId") REFERENCES "nursery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_records" ADD CONSTRAINT "feed_records_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_inventario_nutricion" ADD CONSTRAINT "lotes_inventario_nutricion_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_vacunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_inventario_nutricion" ADD CONSTRAINT "lotes_inventario_nutricion_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulas" ADD CONSTRAINT "formulas_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_versions" ADD CONSTRAINT "formula_versions_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_versions" ADD CONSTRAINT "formula_versions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_ingredients" ADD CONSTRAINT "formula_ingredients_formulaVersionId_fkey" FOREIGN KEY ("formulaVersionId") REFERENCES "formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_ingredients" ADD CONSTRAINT "formula_ingredients_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "vacunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutritional_targets" ADD CONSTRAINT "nutritional_targets_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bal_production_orders" ADD CONSTRAINT "bal_production_orders_formulaVersionId_fkey" FOREIGN KEY ("formulaVersionId") REFERENCES "formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bal_production_orders" ADD CONSTRAINT "bal_production_orders_loteInventarioId_fkey" FOREIGN KEY ("loteInventarioId") REFERENCES "lotes_vacunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "health_tasks" ADD CONSTRAINT "health_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_task_completions" ADD CONSTRAINT "health_task_completions_healthTaskId_fkey" FOREIGN KEY ("healthTaskId") REFERENCES "health_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curative_treatments" ADD CONSTRAINT "curative_treatments_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curative_treatments" ADD CONSTRAINT "curative_treatments_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curative_treatments" ADD CONSTRAINT "curative_treatments_pigletId_fkey" FOREIGN KEY ("pigletId") REFERENCES "piglets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curative_treatments" ADD CONSTRAINT "curative_treatments_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_pigletId_fkey" FOREIGN KEY ("pigletId") REFERENCES "piglets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "curative_treatments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedimientos_maternidad" ADD CONSTRAINT "procedimientos_maternidad_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necropsias" ADD CONSTRAINT "necropsias_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "sows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necropsias" ADD CONSTRAINT "necropsias_boarId_fkey" FOREIGN KEY ("boarId") REFERENCES "boars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necropsias" ADD CONSTRAINT "necropsias_farrowingId_fkey" FOREIGN KEY ("farrowingId") REFERENCES "farrowing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necropsias" ADD CONSTRAINT "necropsias_pigletId_fkey" FOREIGN KEY ("pigletId") REFERENCES "piglets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "whatsapp_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_productos" ADD CONSTRAINT "marketplace_productos_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "marketplace_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_pedidos" ADD CONSTRAINT "marketplace_pedidos_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "marketplace_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_pedido_items" ADD CONSTRAINT "marketplace_pedido_items_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "marketplace_pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_pedido_items" ADD CONSTRAINT "marketplace_pedido_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "marketplace_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_vacunas" ADD CONSTRAINT "lotes_vacunas_vacunaId_fkey" FOREIGN KEY ("vacunaId") REFERENCES "vacunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "vacunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_vacunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolo_items" ADD CONSTRAINT "protocolo_items_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos_sanitarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolo_items" ADD CONSTRAINT "protocolo_items_vacunaId_fkey" FOREIGN KEY ("vacunaId") REFERENCES "vacunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_vacunacion" ADD CONSTRAINT "eventos_vacunacion_vacunaId_fkey" FOREIGN KEY ("vacunaId") REFERENCES "vacunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_vacunas" ADD CONSTRAINT "aplicaciones_vacunas_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos_vacunacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_vacunas" ADD CONSTRAINT "aplicaciones_vacunas_loteVacunaId_fkey" FOREIGN KEY ("loteVacunaId") REFERENCES "lotes_vacunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_vacunas" ADD CONSTRAINT "aplicaciones_vacunas_vacunaId_fkey" FOREIGN KEY ("vacunaId") REFERENCES "vacunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

