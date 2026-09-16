-- Acrescenta o perfil ADMINISTRADOR ao enum de perfis.
--
-- ALTER TYPE ... ADD VALUE é a forma de crescer um enum do PostgreSQL sem
-- recriar a coluna: nenhuma linha existente é tocada, e os quatro perfis
-- atuais continuam valendo exatamente como estavam.
--
-- O PostgreSQL não permite USAR o valor novo na mesma transação em que ele é
-- criado. Por isso esta migração só o declara; quem grava o primeiro usuário
-- com ele é o seed, que roda depois, em outra conexão.

ALTER TYPE "PerfilUsuario" ADD VALUE IF NOT EXISTS 'ADMINISTRADOR';
