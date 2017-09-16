import React, { Component } from 'react';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button';
import { Icon } from 'office-ui-fabric-react/lib/Icon';

import { CrewList } from './CrewList.js';

import { loadGauntlet, gauntletCrewSelection, gauntletRoundOdds, payToGetNewOpponents, playContest } from '../utils/gauntlet.js';
import { getWikiImageUrl } from '../utils/wikiImage.js';

import STTApi from '../api/STTApi.ts';

const CONFIG = require('../utils/config.js');

class GauntletCrew extends React.Component {
	render() {
		return (<table className='table-GauntletCrew'>
			<tbody>
				<tr>
					<td>
						<b>{STTApi.getCrewAvatarBySymbol(this.props.crew.archetype_symbol).name}</b>
					</td>
				</tr>
				<tr>
					<td>
						<Image src={this.props.crew.iconUrl} height={200} style={{ display: 'inline-block' }} />
					</td>
				</tr>
				<tr>
					<td>
					{this.props.crew.disabled ?
						(<span>Disabled <Icon iconName='Dislike' /> ({this.props.crew.debuff/4} battles)</span>) :
						(<span>Active <Icon iconName='Like' /> ({this.props.crew.debuff/4} battles)</span>)
					}
					</td>
				</tr>
				<tr>
					<td>
						{this.props.crew.skills.map(function (skill) {
							return <span className='gauntletCrew-statline' key={skill.skill}>
								<Image src={CONFIG.skillRes[skill.skill].url} height={18} /> {CONFIG.skillRes[skill.skill].name} ({skill.min} - {skill.max})
							</span>;
						})}
						<span className='gauntletCrew-statline'>Crit chance {this.props.crew.crit_chance}%</span>
					</td>
				</tr>
			</tbody>
		</table>);
	}
}

class GauntletMatch extends React.Component {
	constructor(props) {
		super(props);

		this._playMatch = this._playMatch.bind(this);
	}

	_playMatch() {
		playContest(this.props.gauntletId, this.props.match.crewOdd.crew_id, this.props.match.opponent.player_id, this.props.match.opponent.crew_id, function (data) {
			this.props.onNewData(data);
		}.bind(this));
	}

	render() {
		return (<table className='table-GauntletMatch'>
			<tbody>
				<tr>
					<td>
						<center><span>Your <b>{STTApi.getCrewAvatarBySymbol(this.props.match.crewOdd.archetype_symbol).name}</b></span></center>
						<Image src={this.props.match.crewOdd.iconUrl} height={128} />
					</td>
					<td style={{ verticalAlign: 'top' }}>
						<span>has a {this.props.match.chance}% chance of beating</span>
					</td>
					<td>
						<center><span>{this.props.match.opponent.name}'s <b>{STTApi.getCrewAvatarBySymbol(this.props.match.opponent.archetype_symbol).name}</b></span></center>
						<Image src={this.props.match.opponent.iconUrl} height={128} />
					</td>
					<td style={{ verticalAlign: 'top' }}>
						<span>for {this.props.match.opponent.value} points</span>
					</td>
					<td>
						<DefaultButton onClick={this._playMatch} text='Play this match!' iconProps={{ iconName: 'LightningBolt' }} />
					</td>
				</tr>
			</tbody>
		</table>);
	}
}

export class GauntletHelper extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			gauntlet: null
		};

		this._reloadGauntletData = this._reloadGauntletData.bind(this);
		this._gauntletDataRecieved = this._gauntletDataRecieved.bind(this);
		this._payForNewOpponents = this._payForNewOpponents.bind(this);
		this._reloadGauntletData();
	}

	_reloadGauntletData() {
		loadGauntlet().then((data) => this._gauntletDataRecieved({ gauntlet: data }));
	}

	_payForNewOpponents() {
		payToGetNewOpponents(this.state.gauntlet.id, function (data) {
			this._gauntletDataRecieved(data);
		}.bind(this));
	}

	_gauntletDataRecieved(data) {
		if (data.gauntlet) {
			if (data.gauntlet.state == 'NONE') {
				var result = gauntletCrewSelection(data.gauntlet, this.props.crew);

				this.setState({
					gauntlet: data.gauntlet,
					startsIn: Math.floor(data.gauntlet.seconds_to_join / 60),
					featuredSkill: data.gauntlet.contest_data.featured_skill,
					traits: data.gauntlet.contest_data.traits.map(function (trait) { return STTApi.getTraitName(trait); }.bind(this)),
					recommendations: result.recommendations.map(function (id) { return this.props.crew.find((crew) => (crew.id == id)); }.bind(this)),
					bestInSkill: result.best
				});
			}
			else if (data.gauntlet.state == 'STARTED') {
				var result = gauntletRoundOdds(data.gauntlet);
				this.setState({
					gauntlet: data.gauntlet,
					roundOdds: result
				});

				data.gauntlet.contest_data.selected_crew.forEach((crew) => {
					getWikiImageUrl(STTApi.getCrewAvatarBySymbol(crew.archetype_symbol).name.split(' ').join('_') + '.png', crew.crew_id).then(({id, url}) => {
						this.state.gauntlet.contest_data.selected_crew.forEach((crew) => {
							if (crew.crew_id === id) {
								crew.iconUrl = url;
								this.forceUpdate();
							}
						});
					}).catch((error) => { console.warn(error); });
				});

				result.matches.forEach((match) => {
					getWikiImageUrl(STTApi.getCrewAvatarBySymbol(match.crewOdd.archetype_symbol).name.split(' ').join('_') + '.png', match.crewOdd.crew_id).then(({id, url}) => {
						this.state.roundOdds.matches.forEach((match) => {
							if (match.crewOdd.crew_id === id) {
								match.crewOdd.iconUrl = url;
								this.forceUpdate();
							}
						});
					}).catch((error) => { console.warn(error); });

					getWikiImageUrl(STTApi.getCrewAvatarBySymbol(match.opponent.archetype_symbol).name.split(' ').join('_') + '.png', match.opponent.crew_id).then(({id, url}) => {
						this.state.roundOdds.matches.forEach((match) => {
							if (match.opponent.crew_id === id) {
								match.opponent.iconUrl = url;
								this.forceUpdate();
							}
						});
					}).catch((error) => { console.warn(error); });
				});
			}
			else {
				this.setState({
					gauntlet: data.gauntlet
				});
			}
		}
		else if (data.lastResult) {
			{
				let playerRollTotal = data.lastResult.player_rolls.reduce(function(sum, value) { return sum + value; }, 0);
				let opponentRollTotal = data.lastResult.opponent_rolls.reduce(function(sum, value) { return sum + value; }, 0);

				alert('You ' + playerRollTotal + ' vs them ' + opponentRollTotal + '. Result: ' + ((data.lastResult.win == true) ? 'win' : 'lose'));
				//"player_rolls":[137, 143, 147, 0, 1, 1], "opponent_rolls":[1, 0, 0, 218, 274, 206],
				//"player_crit_rolls":[false, false, false, false, false, false],
				//"opponent_crit_rolls":[false, false, false, false, false, false],
			}
		}
	}

	render() {
		if (this.state.gauntlet && (this.state.gauntlet.state == 'NONE')) {
			return (
				<div>
					<Label>Next gauntlet starts in {this.state.startsIn} minutes.</Label>
					<span className='quest-mastery'>Featured skill: <Image src={CONFIG.skillRes[this.state.featuredSkill].url} height={18} /> {CONFIG.skillRes[this.state.featuredSkill].name}</span>
					<Label>Featured traits: {this.state.traits.join(', ')}</Label>
					<h2>Recommeded crew selection:</h2>
					<CrewList data={this.state.recommendations} ref='recommendedCrew' />
				</div>
			);
		}
		else if (this.state.gauntlet && ((this.state.gauntlet.state == 'STARTED') && this.state.roundOdds)) {
			return (
				<div className='tab-panel' data-is-scrollable='true'>
					<h3>Current gauntlet stats</h3>
					<Label>Crew refeshes in {Math.floor(this.state.gauntlet.seconds_to_next_crew_refresh / 60)} minutes and the gauntlet ends in {Math.floor(this.state.gauntlet.seconds_to_end / 60)} minutes</Label>
					<Label>Your rank is {this.state.roundOdds.rank} and you have {this.state.roundOdds.consecutive_wins} consecutive wins</Label>
					<span><h3>Your crew stats <DefaultButton onClick={this._reloadGauntletData} text='Reload data' iconProps={{ iconName: 'Refresh' }} /></h3></span>
					<div style={{display: 'flex'}} >
						{this.state.gauntlet.contest_data.selected_crew.map(function (crew) {
							return <GauntletCrew key={crew.crew_id} crew={crew} />;
						})}
					</div>
					<h3>Gauntlet player - BETA</h3>
					<DefaultButton onClick={this._payForNewOpponents} text='Pay merits for new opponents' iconProps={{ iconName: 'Money' }} />
					{this.state.roundOdds.matches.map(function (match) {
						return <GauntletMatch key={match.crewOdd.archetype_symbol + match.opponent.player_id} match={match} gauntletId={this.state.gauntlet.id} onNewData={this._gauntletDataRecieved} />;
					}.bind(this))}
				</div>
			);
		}
		else {
			return (<MessageBar messageBarType={MessageBarType.error} >Unknown state for this gauntlet! Check the app, perhaps it's waiting to join or already done.</MessageBar>);
		}
	}

	componentDidMount() {
		if (this.refs.recommendedCrew) {
			this.refs.recommendedCrew.setGroupedColumn('');
		}
	}
}