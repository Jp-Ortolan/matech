-- CreateTable
CREATE TABLE "aparelhos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "naFila" INTEGER NOT NULL DEFAULT 0,
    "comErro" INTEGER NOT NULL DEFAULT 0,
    "ultimoContato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aparelhos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "aparelhos" ADD CONSTRAINT "aparelhos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
