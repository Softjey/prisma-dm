export const SUPPORTED_DATASOURCE_PROVIDERS = ["postgresql", "sqlite", 'mysql', 'sqlserver'] as const;
export type SupportedDatasourceProvider = (typeof SUPPORTED_DATASOURCE_PROVIDERS)[number];

export default function isSupportedDatasourceProvider(
  provider: string,
): provider is SupportedDatasourceProvider {
  return SUPPORTED_DATASOURCE_PROVIDERS.includes(provider as SupportedDatasourceProvider);
}
