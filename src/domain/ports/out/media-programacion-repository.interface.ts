export interface MediaProgramacionRow {
  id: number;
  archivo: string;
  tipo: string | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  habilitado: boolean;
}

export interface MediaProgramacionWrite {
  archivo?: string;
  tipo?: string | null;
  fechaInicio?: Date | null;
  fechaFin?: Date | null;
  habilitado?: boolean;
}

export interface ProgramacionMediaRepository {
  getMediaDir(): Promise<string>;
  list(): Promise<MediaProgramacionRow[]>;
  create(data: MediaProgramacionWrite): Promise<MediaProgramacionRow>;
  update(
    id: number,
    data: MediaProgramacionWrite,
  ): Promise<MediaProgramacionRow>;
  delete(id: number): Promise<void>;
}