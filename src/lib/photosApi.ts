import { supabase } from './supabase';
import type { Tables } from './database.types';

export type ProgressPhoto = Tables<'progress_photos'>;

export async function listProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertProgressPhoto(input: {
  userId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  date: string;
}): Promise<void> {
  const { error } = await supabase.from('progress_photos').insert({
    user_id: input.userId,
    image_url: input.imageUrl,
    thumbnail_url: input.thumbnailUrl,
    date: input.date,
  });
  if (error) throw error;
}

export async function deleteProgressPhoto(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('progress_photos')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function uploadProgressPhotoFile(
  userId: string,
  fileName: string,
  file: Blob,
): Promise<string> {
  const { error } = await supabase.storage.from('progress-photos').upload(fileName, file);
  if (error) throw error;
  return supabase.storage.from('progress-photos').getPublicUrl(fileName).data.publicUrl;
}

export async function removeProgressPhotoFiles(paths: string[]): Promise<void> {
  const { error } = await supabase.storage.from('progress-photos').remove(paths);
  if (error) throw error;
}
