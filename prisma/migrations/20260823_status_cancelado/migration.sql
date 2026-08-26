-- Novo status de post: cancelado (semáforo vermelho — cancelado/adiado/reformulado/impedido).
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'cancelado';
