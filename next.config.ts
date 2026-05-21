import path from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

/** App root — keeps resolution inside this folder when the IDE workspace is a parent directory. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
	turbopack: {
		root: projectRoot,
	},
};

export default nextConfig;
