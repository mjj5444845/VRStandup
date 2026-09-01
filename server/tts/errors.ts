export class TTSConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TTSConfigurationError';
  }
}

export class TTSProviderError extends Error {
  readonly providerStatus?: number;

  constructor(message: string, providerStatus?: number) {
    super(message);
    this.name = 'TTSProviderError';
    this.providerStatus = providerStatus;
  }
}
