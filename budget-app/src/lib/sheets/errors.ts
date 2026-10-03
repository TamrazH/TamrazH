/** İstifadəçiyə göstərilə bilən Sheets xətası. Heç vaxt secret məlumat daşımır. */
export type SheetsErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH_FAILED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "UNAVAILABLE"
  | "NETWORK"
  | "UNKNOWN";

export class SheetsError extends Error {
  constructor(
    public readonly code: SheetsErrorCode,
    /** Azərbaycan dilində istifadəçi mesajı */
    public readonly userMessage: string,
    public readonly status?: number,
  ) {
    super(userMessage);
    this.name = "SheetsError";
  }
}

export function errorFromStatus(status: number): SheetsError {
  switch (status) {
    case 400:
      return new SheetsError("BAD_REQUEST", "Google Sheets sorğunu qəbul etmədi (400). Cədvəl strukturunu yoxlayın.", status);
    case 401:
      return new SheetsError("AUTH_FAILED", "Google hesabına giriş alınmadı. Service account açarını yoxlayın.", status);
    case 403:
      return new SheetsError(
        "FORBIDDEN",
        "Cədvələ giriş icazəsi yoxdur. Cədvəli service account e-poçtuna Editor kimi paylaşdığınızı və Sheets API-nin aktiv olduğunu yoxlayın.",
        status,
      );
    case 404:
      return new SheetsError("NOT_FOUND", "Cədvəl tapılmadı. Spreadsheet ID-ni yoxlayın.", status);
    case 429:
      return new SheetsError("RATE_LIMITED", "Google Sheets sorğu limiti aşıldı. Bir neçə dəqiqə sonra yenidən cəhd edin.", status);
    default:
      if (status >= 500) {
        return new SheetsError("UNAVAILABLE", "Google Sheets müvəqqəti əlçatmazdır. Bir az sonra yenidən cəhd edin.", status);
      }
      return new SheetsError("UNKNOWN", `Google Sheets xətası (${status}).`, status);
  }
}
