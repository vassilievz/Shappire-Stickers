import { t } from '@/i18n';


export type AppErrorCode =
  | 'UNKNOWN'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_DELETE_FAILED'
  | 'STORAGE_NOT_AVAILABLE'
  | 'DATA_CORRUPTED'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'IMAGE_DECODE_FAILED'
  | 'IMAGE_ENCODE_FAILED'
  | 'IMAGE_TOO_LARGE'
  | 'WEBP_UNSUPPORTED'
  | 'STICKER_TOO_LARGE'
  | 'STICKER_INVALID_DIMENSIONS'
  | 'PACK_INVALID'
  | 'PACK_TOO_MANY_STICKERS'
  | 'PACK_TOO_FEW_STICKERS'
  | 'PACK_LIMIT_REACHED'
  | 'PACK_MIXED_TYPES'
  | 'PACK_TYPE_MISMATCH'
  | 'CANCELLED'
  | 'NATIVE_UNAVAILABLE'
  | 'WHATSAPP_NOT_INSTALLED'
  | 'WHATSAPP_ADD_FAILED'
  | 'PERMISSION_DENIED'
  | 'AUTH_CANCELLED'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'NATIVE_CONFIG_MISSING'
  | 'UNSUPPORTED_FORMAT'
  | 'OFFLINE'
  | 'UNAUTHORIZED'
  | 'USERNAME_TAKEN'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UPLOAD_FAILED'
  | 'API_NOT_CONFIGURED';

export interface AppErrorOptions {
  cause?: unknown;
  
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;

  readonly details: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  static is(value: unknown): value is AppError {
    return value instanceof AppError;
  }
}


export function toAppError(value: unknown, fallbackCode: AppErrorCode = 'UNKNOWN'): AppError {
  if (AppError.is(value)) {
    return value;
  }
  if (value instanceof Error) {
    return new AppError(fallbackCode, value.message, { cause: value });
  }
  return new AppError(fallbackCode, typeof value === 'string' ? value : 'Erro inesperado', {
    details: { value: String(value) },
  });
}


const FRIENDLY_MESSAGES: Partial<Record<AppErrorCode, string>> = {
  STORAGE_READ_FAILED: 'Não foi possível ler os dados salvos no aparelho.',
  STORAGE_WRITE_FAILED: 'Não foi possível salvar no armazenamento do aparelho.',
  STORAGE_DELETE_FAILED: 'Não foi possível apagar os arquivos deste item.',
  STORAGE_NOT_AVAILABLE: 'O armazenamento local não está disponível neste ambiente.',
  DATA_CORRUPTED: 'Os dados salvos estão corrompidos e precisaram ser reiniciados.',
  NOT_FOUND: 'Item não encontrado.',
  INVALID_INPUT: 'Dados inválidos.',
  IMAGE_DECODE_FAILED: 'Não foi possível abrir esta imagem. Tente outro arquivo PNG, JPEG ou WebP.',
  IMAGE_ENCODE_FAILED: 'Não foi possível gerar o arquivo WebP desta figurinha.',
  IMAGE_TOO_LARGE: 'A imagem é grande demais para ser processada com segurança.',
  WEBP_UNSUPPORTED: 'Este dispositivo não suporta geração de WebP com transparência.',
  STICKER_TOO_LARGE: 'A figurinha ficou acima de 100 KB mesmo após a otimização.',
  STICKER_INVALID_DIMENSIONS: 'A figurinha precisa ter exatamente 512 x 512 pixels.',
  PACK_INVALID: 'Este pacote ainda não atende aos requisitos do WhatsApp.',
  PACK_TOO_MANY_STICKERS: 'Um pacote do WhatsApp aceita no máximo 30 figurinhas.',
  PACK_TOO_FEW_STICKERS: 'Um pacote do WhatsApp precisa de pelo menos 3 figurinhas.',
  PACK_LIMIT_REACHED: 'Limite de 10 pacotes por aplicativo atingido.',
  PACK_MIXED_TYPES:
    'O WhatsApp não permite misturar figurinhas estáticas e animadas no mesmo pacote.',
  PACK_TYPE_MISMATCH:
    'O tipo da figurinha não corresponde ao tipo deste pacote.',
  CANCELLED: 'Operação cancelada.',
  NATIVE_UNAVAILABLE: 'Este recurso só está disponível no aplicativo Android instalado.',
  WHATSAPP_NOT_INSTALLED: 'O WhatsApp não está instalado neste aparelho.',
  WHATSAPP_ADD_FAILED: 'O WhatsApp não conseguiu adicionar este pacote.',
  PERMISSION_DENIED: 'Permissão negada pelo sistema.',
  AUTH_CANCELLED: 'O login com o Google foi cancelado.',
  AUTH_FAILED: 'Não foi possível concluir o login com o Google.',
  NETWORK_ERROR: 'Sem conexão com a internet. Verifique sua rede e tente novamente.',
  NATIVE_CONFIG_MISSING: 'Configuração nativa do Firebase pendente no Android (google-services.json).',
  UNSUPPORTED_FORMAT: 'Formato de imagem não suportado. Use PNG, JPEG, WebP ou GIF.',
  OFFLINE: 'Você está offline. Esta ação precisa de conexão com a internet.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente para continuar.',
  USERNAME_TAKEN: 'Este usuário já está em uso.',
  RATE_LIMIT_EXCEEDED: 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.',
  UPLOAD_FAILED: 'Não foi possível enviar a imagem. Verifique a conexão e tente novamente.',
  API_NOT_CONFIGURED: 'O endereço da API não está configurado neste ambiente.',
};

export function friendlyMessage(error: unknown): string {
  const appError = toAppError(error);
  const localized = t(`errors.${appError.code}`);
  if (localized !== `errors.${appError.code}`) {
    return localized;
  }
  return FRIENDLY_MESSAGES[appError.code] || appError.message || t('errors.UNKNOWN');
}
