/**
 * Shared types, constants, and utilities for AI Assistant platform.
 * Used by apps/web, apps/api (via matching Pydantic schemas), and packages/connectors.
 */

export const PACKAGE_VERSION = "0.0.1";

export * from "./intents.js";
export * from "./connector.js";
export * from "./api.js";
export * from "./errors.js";
