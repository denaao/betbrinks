/*
  Warnings:

  - Made the column `key` on table `sports` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "sports" ALTER COLUMN "key" SET NOT NULL;
