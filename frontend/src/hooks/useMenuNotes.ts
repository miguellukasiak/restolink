import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createMenuNote,
  deleteMenuNote,
  fetchMenuNotes,
  updateMenuNote,
} from '../services/menuService';
import { writesTo } from '../services/cacheSync';
import { menuQueryKeys } from './useMenu';
import type { MenuNoteStyle } from '../types';

/** The owner's notes between the menu's sections. */
export function useMenuNotes(restaurantId: string) {
  return useQuery({
    queryKey: menuQueryKeys.notes(restaurantId),
    queryFn: () => fetchMenuNotes(restaurantId),
    enabled: Boolean(restaurantId),
    meta: { reads: ['menu'] },
  });
}

interface AddNoteVariables {
  body: string;
  at: 'start' | 'end';
  style: MenuNoteStyle;
}

export function useAddMenuNote(restaurantId: string) {
  return useMutation({
    mutationFn: ({ body, at, style }: AddNoteVariables) =>
      createMenuNote(restaurantId, body, at, style),
    // Refreshes the board, the previews, "Languages" and the guest menu.
    meta: writesTo(restaurantId, ['menu']),
  });
}

interface UpdateNoteVariables {
  noteId: string;
  body: string;
  style: MenuNoteStyle;
}

export function useUpdateMenuNote(restaurantId: string) {
  return useMutation({
    mutationFn: ({ noteId, body, style }: UpdateNoteVariables) =>
      updateMenuNote(restaurantId, noteId, body, style),
    meta: writesTo(restaurantId, ['menu']),
  });
}

export function useDeleteMenuNote(restaurantId: string) {
  return useMutation({
    mutationFn: (noteId: string) => deleteMenuNote(restaurantId, noteId),
    meta: writesTo(restaurantId, ['menu']),
  });
}
