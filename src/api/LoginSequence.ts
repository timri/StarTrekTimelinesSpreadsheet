import STTApi from "./index";
import CONFIG from "./CONFIG";
import { buildCrewData, buildCrewDataAll } from './CrewTools';
import { matchShips } from './ShipTools';
import { loadMissionData } from './MissionTools';
import { loadFullTree, fixupAllCrewIds, getMissionCostDetails } from './EquipmentTools';
import { refreshAllFactions, loadFactionStore } from './FactionTools';
import { calculateMissionCrewSuccess, calculateMinimalComplementAsync } from './MissionCrewSuccess';
import { CrewData, CrewDTO, ItemData, PotentialRewardDTO, RewardDTO } from "./DTO";
import { IFoundResult } from "../components/images/ImageProvider";

export async function loginSequence(onProgress: (description: string) => void) {
    let mainResources = [
        {
            loader: STTApi.loadCrewArchetypes.bind(STTApi),
            description: 'crew information'
        },
        {
            loader: STTApi.loadServerConfig.bind(STTApi),
            description: 'server configuration'
        },
        {
            loader: STTApi.loadPlatformConfig.bind(STTApi),
            description: 'platform configuration'
        },
        {
            loader: STTApi.loadShipSchematics.bind(STTApi),
            description: 'ship information'
        },
        {
            loader: STTApi.loadBigBook.bind(STTApi),
            description: 'big book'
        },
        {
            loader: STTApi.loadPlayerData.bind(STTApi),
            description: 'player data'
        }
    ];

    let fleetResources = [
        {
            loader: STTApi.loadFleetMemberInfo.bind(STTApi),
            description: 'fleet members'
        },
        {
            loader: STTApi.loadFleetData.bind(STTApi),
            description: 'fleet data'
        },
        {
            loader: STTApi.loadStarbaseData.bind(STTApi),
            description: 'starbase data'
        }
    ];

    // These things are now loading in parallel, the status will always be the last one in the list (which is probably fine)
    let promises: Array<Promise<void>> = [];
    for (let res of mainResources) {
        onProgress('Loading ' + res.description + '...');
        promises.push(res.loader());
    }

    await Promise.all(promises);

    let iconPromises: Array<Promise<void>> = [];
    if (STTApi.playerData.fleet && STTApi.playerData.fleet.id != 0) {
        for (let res of fleetResources) {
            onProgress('Loading ' + res.description + '...');
            iconPromises.push(res.loader(STTApi.playerData.fleet.id));
        }
    }

    onProgress('Loading missions and quests...');
    // Filter out missions in a bad state
    STTApi.playerData.character.accepted_missions = STTApi.playerData.character.accepted_missions.filter((mission) => mission.main_story);
    let ms = [...STTApi.playerData.character.cadet_schedule.missions,
              ...STTApi.playerData.character.accepted_missions];
    let missions = await loadMissionData(ms, STTApi.playerData.character.dispute_histories);
    STTApi.missions = missions;

    onProgress('Analyzing crew...');
    let roster: CrewData[] = await buildCrewData(STTApi.playerData.character);
    STTApi.roster = roster;

    // Not really an "icon", but adding it here because this is what we wait on at the end
    // of this function (so code could run in parallel, especially network loads)
    //iconPromises.push(() => {
        onProgress('Calculating mission success stats for crew...');
        STTApi.missionSuccess = calculateMissionCrewSuccess();
        calculateMinimalComplementAsync();
    //});

    let total = roster.length * 2 + STTApi.crewAvatars.length;
    let current = 0;
    onProgress('Caching crew images... (' + current + '/' + total + ')');

    for (let rosterCrew of roster) {
        if (rosterCrew.iconUrl === '') {
            iconPromises.push(STTApi.imageProvider.getCrewImageUrl(rosterCrew, false).then((found: IFoundResult) => {
                current++;
                if (current % 10 == 0)
                    onProgress('Caching crew images... (' + current + '/' + total + ')');
                rosterCrew.iconUrl = found.url;
            }).catch((error: any) => { /*console.warn(error);*/ }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching crew images... (' + current++ + '/' + total + ')');
        }

        if (rosterCrew.iconBodyUrl === '') {
            iconPromises.push(STTApi.imageProvider.getCrewImageUrl(rosterCrew, true).then((found: IFoundResult) => {
                current++;
                if (current % 10 == 0)
                    onProgress('Caching crew images... (' + current + '/' + total + ')');
                rosterCrew.iconBodyUrl = found.url;
            }).catch((error: any) => { /*console.warn(error);*/ }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching crew images... (' + current++ + '/' + total + ')');
        }
    }

    onProgress('Caching crew images... (' + current + '/' + total + ')');

    // Also load the avatars for crew not in the roster
    for (let avatar of STTApi.crewAvatars) {
        avatar.iconUrl = STTApi.imageProvider.getCrewCached(avatar, false);
        if (avatar.iconUrl === '') {
            iconPromises.push(STTApi.imageProvider.getCrewImageUrl(avatar, false).then((found: IFoundResult) => {
                current++;
                if (current % 10 == 0)
                    onProgress('Caching crew images... (' + current + '/' + total + ')');
                avatar.iconUrl = found.url;
            }).catch((error: any) => { /*console.warn(error);*/ }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching crew images... (' + current++ + '/' + total + ')');
        }
    }

    onProgress('Caching crew images... (' + current + '/' + total + ')');

    //await Promise.all(iconPromises);

    onProgress('Loading ships...');

    let ships = await matchShips(STTApi.playerData.character.ships);
    STTApi.ships = ships;

    total += ships.length;
    //current = 0;
    onProgress('Caching ship images... (' + current + '/' + total + ')');
    //iconPromises = [];
    for (let ship of ships) {
        ship.iconUrl = STTApi.imageProvider.getCached(ship);
        if (ship.iconUrl === '') {
            iconPromises.push(STTApi.imageProvider.getShipImageUrl(ship).then((found: IFoundResult) => {
                onProgress('Caching ship images... (' + current++ + '/' + total + ')');
                let ship = STTApi.ships.find((ship) => ship.name === found.id);
                if (ship) {
                    ship.iconUrl = found.url;
                }
            }).catch((error: any) => { /*console.warn(error);*/ }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching ship images... (' + current++ + '/' + total + ')');
        }
    }

    onProgress('Caching ship images... (' + current + '/' + total + ')');

    //await Promise.all(iconPromises);

    onProgress('Caching item details...');

    await refreshAllFactions();

    let rewardItemIds = new Map<string, Set<number>>();
    const scanRewards = (name: string, potential_rewards?: (PotentialRewardDTO | RewardDTO)[]) => {
        if (!potential_rewards)
            return;
        potential_rewards.forEach(reward => {
            if ((reward as PotentialRewardDTO).potential_rewards) {
                scanRewards(name, (reward as PotentialRewardDTO).potential_rewards);
            } else if (reward.type === 2) {
                rewardItemIds.get(name)!.add((reward as RewardDTO).id);
            }
        });
    };
    const apiref = STTApi;

    STTApi.playerData.character.factions.forEach(f => {
        rewardItemIds.set(f.name, new Set());
        scanRewards(f.name, f.shuttle_mission_rewards);
    });

    total += STTApi.playerData.character.items.length;
    //current = 0;
    onProgress('Caching item images... (' + current + '/' + total + ')');
    //iconPromises = [];
    STTApi.items = [];
    for (let itemDTO of STTApi.playerData.character.items) {
        try {
            let item : ItemData = {
                ...itemDTO,
                factions: [],
                iconUrl: STTApi.imageProvider.getCached(itemDTO),
                //typeName = itemDTO.icon.file.replace("/items", "").split("/")[1];
                //symbol2 = itemDTO.icon.file.replace("/items", "").split("/")[2];
                sources: []
            };
            STTApi.items.push(item);

            //NOTE: this used to overwrite the DTO's symbol; is it needed?
            //itemDTO.symbol = itemDTO.icon.file.replace("/items", "").split("/")[2];

            if (item.iconUrl === '') {
                iconPromises.push(STTApi.imageProvider.getItemImageUrl(item, item.id).then((found: IFoundResult) => {
                    current++;
                    if (current % 10 == 0)
                        onProgress('Caching item images... (' + current + '/' + total + ')');
                    //let foundDTO = STTApi.playerData.character.items.find((item) => item.id === found.id);
                    let foundItem = STTApi.items.find((item) => item.id === found.id);
                    if (foundItem) {
                        foundItem.iconUrl = found.url || '';
                    }
                }).catch((error) => { /*console.warn(error);*/ }));
            } else {
                // Image is already cached

                current++;
                // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
                //onProgress('Caching item images... (' + current++ + '/' + total + ')');
            }

            item.cadetable = '';
            let cadetSources = STTApi.getEquipmentManager().getCadetableItems().get(item.archetype_id);
            if (cadetSources) {
                cadetSources.forEach(v => {
                    let name = v.mission.episode_title;
                    let mastery = v.masteryLevel;

                    let questName = v.quest.action;
                    let questIndex = null;
                    v.mission.quests.forEach((q, i) => {
                        if (q.id === v.quest.id)
                            questIndex = i + 1;
                    });

                    if (item.cadetable)
                        item.cadetable += ' | ';
                    item.cadetable += name + ' : ' + questIndex + ' : ' + questName + ' : ' + CONFIG.MASTERY_LEVELS[mastery].name;

                    const costDetails = getMissionCostDetails(v.quest.id, mastery);

                    item.sources.push({
                        chance: 0,
                        quotient: 0,
                        title: name + ' #' + questIndex + ' ' + CONFIG.MASTERY_LEVELS[mastery].name + ' (' + questName + ')' ,//+
                           // '[' + entry.chance_grade + '/5 @ ' +
                            //costDetails.cost + ' Chrons (q=' + (Math.round(entry.energy_quotient * 100) / 100) + ')]',
                        type: 'cadet',
                        mission: v.mission,
                        quest: v.quest,
                    });
                });
            }

            let iter = rewardItemIds.entries();
            for (let n = iter.next(); !n.done; n = iter.next()) {
                let e = n.value;
                if (e[1].has(item.archetype_id)) {
                    item.factions.push(e[0]);
                }
                n = iter.next();
            }

            let archetype = STTApi.itemArchetypeCache.archetypes.find(a => a.id === item.archetype_id);
            if (archetype) {
                let missions = archetype.item_sources.filter(e => e.type === 0 || e.type === 1 || e.type === 2);
                const sources = missions.map((entry, idx) => {
                    const chance = entry.chance_grade / 5;
                    const quotient = entry.energy_quotient;
                    if (entry.type == 1) {
                        return {
                            chance,
                            quotient: 0,
                            title: entry.name,
                            type: 'faction'
                        };
                    }
                    const costDetails = getMissionCostDetails(entry.id, entry.mastery);
                    let title = '';
                    if (costDetails.mission && costDetails.quest && costDetails.cost && costDetails.questMastery) {
                        const qoff = costDetails.mission.quests.indexOf(costDetails.quest) + 1;
                        const missionTitle = costDetails.mission.description.length > costDetails.mission.episode_title.length ?
                            costDetails.mission.episode_title : costDetails.mission.description;
                        title = missionTitle + ' #' + qoff + ' '+CONFIG.MASTERY_LEVELS[costDetails.questMastery.id].name+' (' + costDetails.quest.name + ')[' + entry.chance_grade + '/5 @ ' + costDetails.cost + ' Chrons (q=' + (Math.round(entry.energy_quotient * 100) / 100) + ')]';
                    }
                    return {
                        ...costDetails,
                        chance,
                        quotient,
                        title,
                        type: entry.type === 0 ? 'dispute' : 'ship'
                    };
                });
                const filtered = sources.filter(s => s.title !== '');
                filtered.forEach(src => item.sources.push(src))
                //console.log("  Item sources: " + filtered);
            }
            else {
                //console.log("  Item archetype not found");
            }

            //console.log('Item: ' + item.name + ' rarity:' + item.rarity + ' sym:' + item.symbol + ' aid:' + item.archetype_id + ' iid:' + item.id
            // + (' srcs:' + item.sources.map((src, idx, all) => src.title +'-' + src.type + (idx === all.length - 1 ? '' : ', '))));
        }
        catch (e) {
            console.error(e);
        }
    }

    onProgress('Caching item images... (' + current + '/' + total + ')');

    //await Promise.all(iconPromises);

    onProgress('Caching faction images...');

    total += STTApi.playerData.character.factions.length;
    //current = 0;
    onProgress('Caching faction images... (' + current + '/' + total + ')');
    //iconPromises = [];
    for (let faction of STTApi.playerData.character.factions) {
        faction.iconUrl = STTApi.imageProvider.getCached(faction);

        if (!faction.iconUrl || faction.iconUrl === '') {
            iconPromises.push(STTApi.imageProvider.getFactionImageUrl(faction, faction.id).then((found: IFoundResult) => {
                onProgress('Caching faction images... (' + current++ + '/' + total + ')');
                let faction = STTApi.playerData.character.factions.find((faction) => faction.id === found.id);
                if (faction) {
                    faction.iconUrl = found.url;
                }
            }).catch((error: any) => { /*console.warn(error);*/ }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching faction images... (' + current++ + '/' + total + ')');
        }

        iconPromises.push(loadFactionStore(faction));
    }

    onProgress('Caching faction images... (' + current + '/' + total + ')');

    //await Promise.all(iconPromises);

    onProgress('Loading crew cache...');

    try {
        let allcrew : CrewDTO[] | undefined = undefined;
        allcrew = await STTApi.networkHelper.get(STTApi.serverAddress + 'allcrew.json', undefined);
        STTApi.allcrew = buildCrewDataAll(allcrew || []);
    }
    catch (e) {
        console.error(e);
        STTApi.allcrew = [];
    }

    // Also load the avatars for crew not in the roster
    for (let crew of STTApi.allcrew) {
        crew.iconUrl = STTApi.imageProvider.getCrewCached(crew, false);
        if (crew.iconUrl === '') {
            iconPromises.push(STTApi.imageProvider.getCrewImageUrl(crew, false).then((found: IFoundResult) => {
                current++;
                if (current % 10 === 0) {
                    onProgress('Caching crew images... (' + current + '/' + total + ')');
                }
                crew.iconUrl = found.url;
            }).catch((error: any) => { /*console.warn(error);*/ }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching crew images... (' + current++ + '/' + total + ')');
        }
    }

    onProgress('Loading equipment...');
    if (STTApi.inWebMode) {
        // In web mode we already augmented the itemarchetypes with whatever we had cached, just try to fix stuff up here
        fixupAllCrewIds();
    } else {
        await loadFullTree(onProgress, false);
    }

    // We no longer need to keep these around
    STTApi.allcrew.forEach((crew: CrewData) => {
        crew.archetypes = [];
    });

    onProgress('Caching images...');

    // Trick the UI into updating (yield)
    await new Promise(resolve => setTimeout(resolve, 50));

    total += STTApi.itemArchetypeCache.archetypes.length;
    //current = 0;
    onProgress('Caching equipment images... (' + current + '/' + total + ')');

    //iconPromises = [];
    for (let equipment of STTApi.itemArchetypeCache.archetypes) {
        equipment.iconUrl = STTApi.imageProvider.getCached(equipment);
        if (equipment.iconUrl === '') {
            iconPromises.push(STTApi.imageProvider.getItemImageUrl(equipment, equipment.id).then((found: IFoundResult) => {
                current++;
                if (current % 10 == 0) {
                    onProgress('Caching equipment images... (' + current + '/' + total + ')');
                }
                let item = STTApi.itemArchetypeCache.archetypes.find((item) => item.id === found.id);
                if (item) {
                    item.iconUrl = found.url;
                }
            }).catch((error) => { }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching equipment images... (' + current++ + '/' + total + ')');
        }
    }

    onProgress('Caching equipment images... (' + current + '/' + total + ')');

    //await Promise.all(iconPromises);

    total += Object.keys(CONFIG.SPRITES).length;
    //current = 0;
    onProgress('Caching misc images... (' + current + '/' + total + ')');
    //iconPromises = [];
    for (let sprite in CONFIG.SPRITES) {
        CONFIG.SPRITES[sprite].url = STTApi.imageProvider.getSpriteCached(CONFIG.SPRITES[sprite].asset, sprite);
        if (CONFIG.SPRITES[sprite].url === '') {
            iconPromises.push(STTApi.imageProvider.getSprite(CONFIG.SPRITES[sprite].asset, sprite, sprite).then((found: IFoundResult) => {
                onProgress('Caching misc images... (' + current++ + '/' + total + ')');
                CONFIG.SPRITES[found.id].url = found.url;
            }).catch((error: any) => { /*console.warn(error);*/ }));
        } else {
            // Image is already cached

            current++;
            // If we leave this in, stupid React will re-render everything, even though we're in a tight synchronous loop and no one gets to see the updated value anyway
            //onProgress('Caching misc images... (' + current++ + '/' + total + ')');
        }
    }

    onProgress('Finishing up...');

    await Promise.all(iconPromises);
}
