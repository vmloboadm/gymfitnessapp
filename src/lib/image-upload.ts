"use client";

/**
 * Fotos de iPhone vêm em HEIC, que o servidor (sharp) não lê. Converte para
 * JPEG no aparelho antes de enviar. Outros formatos passam direto.
 */

type Heic2Any = (opts: { blob: Blob; toType: string; quality?: number }) => Promise<Blob | Blob[]>;

export async function ensureUploadableImage(file: File): Promise<File> {
  const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (!isHeic) return file;
  const mod = (await import("heic2any")) as unknown as { default: Heic2Any };
  const converted = await mod.default({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
}
