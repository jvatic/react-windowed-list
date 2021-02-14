import * as React from 'react';

import WindowedListState, { defaultHeight } from './WindowedListState';
import WindowedList, { WindowedListItem } from './WindowedList';

export interface Props {
	items: Item[];
}

export interface Item {
	height: number;
}

export default function ScrollDemo({ items }: Props) {
	const estimatedHeight = 200;

	const windowedListState = React.useMemo(() => new WindowedListState(defaultHeight(estimatedHeight)), []);

	React.useEffect(
		() => {
			windowedListState.calculateVisibleIndices();

			console.log(windowedListState);
		},
		[windowedListState, items]
	);

	React.useEffect(
		() => {
			windowedListState.updateLength(items.length);
		},
		[windowedListState, items.length]
	);

	return (
		<>
			<h1>Windowed List Demo</h1>
			<p>Items in the list below have a random height between 50 and 400 px.</p>
			<p>
				We've set an estimated height of {estimatedHeight}
				px.
			</p>
			<p>As the list is scrolled, actual item heights are reported and scrolling is adjusted.</p>
			<WindowedList state={windowedListState} thresholdTop={400} thresholdBottom={1000}>
				{(startIndex, length, windowedListItemProps) => {
					return items.slice(startIndex, startIndex + length).map((item, i) => {
						const index = startIndex + i;
						const key = `${i}`;
						return (
							<WindowedListItem key={key} index={index} {...windowedListItemProps}>
								{(ref) => {
									return (
										<article ref={ref as any} style={{ height: item.height, width: 400, border: '1px solid black' }}>
											{itemInnerText(index, items.length, item)}
										</article>
									);
								}}
							</WindowedListItem>
						);
					});
				}}
			</WindowedList>
		</>
	);
}

function itemInnerText(index: number, length: number, item: Item): string {
	return `[${index + 1} / ${length}] ${item.height}px tall`;
}
