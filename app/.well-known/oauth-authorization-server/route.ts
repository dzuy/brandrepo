import { oauthMetadata, publicBaseUrl } from "../../../lib/oauth";

export async function GET(request: Request) {
  return Response.json(oauthMetadata(publicBaseUrl(request)));
}
