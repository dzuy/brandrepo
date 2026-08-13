import { protectedResourceMetadata, publicBaseUrl } from "../../../lib/oauth";

export async function GET(request: Request) {
  return Response.json(protectedResourceMetadata(publicBaseUrl(request)));
}
