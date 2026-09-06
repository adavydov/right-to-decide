export const editorialConnected = process.env.NEXT_PUBLIC_EDITORIAL_MODE === "connected" && Boolean((process.env.NEXT_PUBLIC_EDITORIAL_API_URL || "").trim());
