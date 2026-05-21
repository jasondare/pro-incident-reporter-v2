/**
 * Firebase Admin SDK initialization and Firestore accessors.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { type CollectionReference, type DocumentData, type Firestore, getFirestore } from "firebase-admin/firestore";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ARTIFACT_APP_ID = "everyday-mandarin";

/** Server-only — used by Admin SDK and API routes. */
export function getIncidentArtifactAppId(): string {
	const id = process.env.FIREBASE_ARTIFACT_APP_ID?.trim();
	if (id) {
		return id;
	}
	if (process.env.NODE_ENV === "development") {
		console.warn(
			`[firebase/admin] FIREBASE_ARTIFACT_APP_ID unset; using "${DEFAULT_ARTIFACT_APP_ID}".`,
		);
	}
	return DEFAULT_ARTIFACT_APP_ID;
}

// ============================================================================
// Admin SDK Initialization
// ============================================================================

let db: Firestore | null = null;

function loadServiceAccountJson(): Parameters<typeof cert>[0] {
	const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
	if (filePath) {
		const resolved = path.isAbsolute(filePath)
			? filePath
			: path.join(process.cwd(), filePath);
		const raw = readFileSync(resolved, "utf8");
		return JSON.parse(raw) as Parameters<typeof cert>[0];
	}
	const inline = process.env.BE_FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
	if (inline) {
		return JSON.parse(inline) as Parameters<typeof cert>[0];
	}
	throw new Error(
		"Set FIREBASE_SERVICE_ACCOUNT_PATH (path to service account .json) or BE_FIREBASE_SERVICE_ACCOUNT_KEY (single-line JSON) in .env.local.",
	);
}

function initAdminApp(): void {
	if (getApps().length > 0) return;
	const credentials = loadServiceAccountJson();
	initializeApp({ credential: cert(credentials) });
}

/** Firestore via Admin SDK (bypasses client security rules; keep routes guarded). */
export function getAdminFirestore(): Firestore {
	if (db) return db;
	initAdminApp();
	db = getFirestore();
	return db;
}

// ============================================================================
// Collection Accessors
// ============================================================================

/** `artifacts/{appId}/public/data/incident-reports` */
export function getIncidentReportsCollection(): CollectionReference<DocumentData> {
	const appId = getIncidentArtifactAppId();
	return getAdminFirestore()
		.collection("artifacts")
		.doc(appId)
		.collection("public")
		.doc("data")
		.collection("incident-reports");
}
