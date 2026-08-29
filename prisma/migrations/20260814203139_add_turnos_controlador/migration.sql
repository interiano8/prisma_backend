-- CreateTable
CREATE TABLE "turnos_controlador" (
    "id" SERIAL NOT NULL,
    "period_id" TEXT,
    "start_date" TEXT,
    "start_time" TEXT,
    "additional_details" TEXT,
    "fecha_creacion" TIMESTAMPTZ(6),

    CONSTRAINT "turnos_controlador_pkey" PRIMARY KEY ("id")
);
