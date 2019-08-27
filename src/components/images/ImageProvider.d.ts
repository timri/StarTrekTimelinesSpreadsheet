export interface IFoundResult {
	id: any;
	url: string | undefined;
}

export interface IBitmap {
	width: number;
	height: number;
	data: Uint8Array;
}

export interface ImageCache {
	getImage(url: string): Promise<string|undefined>;
	saveImage(url: string, data: IBitmap): Promise<string>;
	getCached(url: string): string;
}

export interface ImageProvider {
	getCrewImageUrl(crew: CrewData, fullBody: boolean, id: number = 0): Promise<IFoundResult>;
	getShipImageUrl(ship: { name: string; icon: { file: string } }, name: string): Promise<IFoundResult>;
	getItemImageUrl(item: any, id: number): Promise<IFoundResult>;
	getFactionImageUrl(faction: any, id: any): Promise<IFoundResult>;
	getSprite(assetName: string, spriteName: string, id: string): Promise<IFoundResult>;
	getImageUrl(iconFile: string, id: any): Promise<IFoundResult>;
	getCached(withIcon: any): string;
	getCrewCached(crew: CrewData, fullBody: boolean): string;
	getSpriteCached(assetName: string, spriteName: string): string;
}