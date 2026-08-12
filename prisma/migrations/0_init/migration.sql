-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('rascunho', 'agendado', 'publicado', 'falhou');

-- CreateEnum
CREATE TYPE "FonteTipo" AS ENUM ('csv', 'xlsx', 'pdf');

-- CreateEnum
CREATE TYPE "CompCategoria" AS ENUM ('espaco', 'marca', 'certificado', 'cobranca');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "zernioProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "redes" JSONB NOT NULL DEFAULT '{}',
    "paineis" JSONB NOT NULL DEFAULT '{}',
    "contas" JSONB NOT NULL DEFAULT '{}',
    "cfgOpen" JSONB NOT NULL DEFAULT '{}',
    "impOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "segmento" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "site" TEXT NOT NULL DEFAULT '',
    "canais" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "produtos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relacao" JSONB NOT NULL DEFAULT '{}',
    "kitArquivo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL DEFAULT '09:00',
    "titulo" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "colab" TEXT NOT NULL DEFAULT '',
    "pilar" TEXT NOT NULL DEFAULT '',
    "formato" TEXT NOT NULL DEFAULT '',
    "funil" TEXT NOT NULL DEFAULT '',
    "legenda" TEXT NOT NULL DEFAULT '',
    "cta" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "arquivo" TEXT NOT NULL DEFAULT '',
    "status" "PostStatus" NOT NULL DEFAULT 'rascunho',
    "contas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zernioPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fonte" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "FonteTipo" NOT NULL,
    "campos" INTEGER NOT NULL DEFAULT 0,
    "usados" INTEGER NOT NULL DEFAULT 0,
    "linhas" INTEGER NOT NULL DEFAULT 0,
    "pendente" BOOLEAN NOT NULL DEFAULT false,
    "camposMap" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fonte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objetivo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KR" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "kr" TEXT NOT NULL DEFAULT '',
    "alvo" TEXT NOT NULL DEFAULT '',
    "un" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "resp" TEXT NOT NULL DEFAULT '',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "realizado" TEXT,

    CONSTRAINT "KR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL DEFAULT '',
    "cover" TEXT NOT NULL DEFAULT '',
    "nome" TEXT NOT NULL,
    "representa" TEXT NOT NULL DEFAULT '',
    "comunica" TEXT NOT NULL DEFAULT '',
    "dores" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canais" TEXT NOT NULL DEFAULT '',
    "gatilho" TEXT NOT NULL DEFAULT '',
    "stats" JSONB NOT NULL DEFAULT '[]',
    "foto" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concorrente" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ig" TEXT NOT NULL DEFAULT '',
    "linkedin" BOOLEAN NOT NULL DEFAULT false,
    "youtube" BOOLEAN NOT NULL DEFAULT false,
    "dominio" TEXT,
    "categoria" "CompCategoria" NOT NULL,
    "iconOverride" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Concorrente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvConfig_workspaceId_key" ON "EnvConfig"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_workspaceId_key" ON "Perfil"("workspaceId");

-- CreateIndex
CREATE INDEX "Post_workspaceId_data_idx" ON "Post"("workspaceId", "data");

-- CreateIndex
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- CreateIndex
CREATE INDEX "Fonte_workspaceId_idx" ON "Fonte"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Objetivo_workspaceId_key" ON "Objetivo"("workspaceId");

-- CreateIndex
CREATE INDEX "Area_workspaceId_idx" ON "Area"("workspaceId");

-- CreateIndex
CREATE INDEX "KR_areaId_idx" ON "KR"("areaId");

-- CreateIndex
CREATE INDEX "Persona_workspaceId_idx" ON "Persona"("workspaceId");

-- CreateIndex
CREATE INDEX "Concorrente_workspaceId_categoria_idx" ON "Concorrente"("workspaceId", "categoria");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvConfig" ADD CONSTRAINT "EnvConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fonte" ADD CONSTRAINT "Fonte_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objetivo" ADD CONSTRAINT "Objetivo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KR" ADD CONSTRAINT "KR_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concorrente" ADD CONSTRAINT "Concorrente_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

