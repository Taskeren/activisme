import {
  DestinyCharacterComponent,
  DestinyHistoricalStatsPeriodGroup,
  DestinyInventoryItemDefinition,
} from "@taskeren/bungie-api-ts/destiny2";
import { AnalyzedGroup } from "./analyze";
import { UserInfoCard } from "@taskeren/bungie-api-ts/user";

export interface HistoriesResponse {
  histories: DestinyHistoricalStatsPeriodGroup[];
  characters: { [K: string]: DestinyCharacterComponent };
  userInfo: UserInfoCard;
  emblemDefinition?: DestinyInventoryItemDefinition;
}

export type HistoriesResponse2 = Omit<HistoriesResponse, "histories"> & {
  histories: AnalyzedGroup[];
};
