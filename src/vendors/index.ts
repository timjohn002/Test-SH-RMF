import type { ComponentType } from 'react'
import { KeenonConfig } from './keenon/KeenonConfig'

/**
 * Config page per vendor. Each vendor's page can look completely different;
 * the vendor ids must match the server registry in netlify/vendors/index.ts.
 */
export const VENDOR_CONFIG_PAGES: Record<string, ComponentType<{ vendorId: string }>> = {
  keenon: KeenonConfig,
}
