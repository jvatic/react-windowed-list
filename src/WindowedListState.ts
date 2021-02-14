import { debounce } from 'lodash';

type CallbackFunction = (state: WindowedListState) => void;
type UnsubscribeFunction = () => void;

type Option = (state: WindowedListState) => void;

export function defaultHeight(height: number): Option {
	return (state: WindowedListState) => {
		state.defaultHeight = height;
	};
}

export function scrollTop(scrollTop: number): Option {
	return (state: WindowedListState) => {
		state.scrollTop = scrollTop;
	};
}

export default class WindowedListState {
	public viewportHeight: number; // viewport height in px
	public length: number; // size of list
	public defaultHeight: number; // estimated height of list item if we don't have the actual height

	public visibleIndexTop: number; // first index to be rendered
	public visibleLength: number; // number of items to be rendered
	public paddingTop: number; // estimated height of all items not rendered above the first visible index
	public paddingBottom: number; // estimated height of all items not rendered below the last visible index
	public scrollTop: number; // current scroll offset

	private heights: Map<number, number>; // index => height
	private totalHeight: number;
	private subscribers: Set<CallbackFunction>;
	private handleChange: () => void; // debounced version of _handleChange
	private visibleIndicesCalculated: boolean; // flag for if calculateVisibleIndices has been run

	constructor(...options: Option[]) {
		this.viewportHeight = 1;
		this.length = 0;
		this.defaultHeight = 0;

		options.forEach((fn) => fn(this));

		this.visibleIndexTop = 0;
		this.visibleLength = 0;
		this.paddingTop = 0;
		this.paddingBottom = 0;

		this.scrollTop = 0;
		this.heights = new Map<number, number>();
		this.totalHeight = this.length * this.defaultHeight;
		this.subscribers = new Set<CallbackFunction>();
		this.handleChange = debounce(this._handleChange, 0, { maxWait: 60 });
		this.visibleIndicesCalculated = false;
	}

	public onChange(cb: CallbackFunction): UnsubscribeFunction {
		this.subscribers.add(cb);
		return () => {
			this.subscribers.delete(cb);
		};
	}

	public calculateVisibleIndices(): void {
		if (this.scrollTop === 0) {
			this.visibleIndexTop = 0;
			this.paddingTop = 0;
		} else {
			let visibleIndexTop = 0;
			let paddingTop = 0;
			for (let i = 0; i < this.length; i++) {
				const height = this.getItemHeight(i);
				if (paddingTop + height <= this.scrollTop) {
					paddingTop = paddingTop + height;
					visibleIndexTop++;
				} else {
					break;
				}
			}
			this.visibleIndexTop = visibleIndexTop;
			this.paddingTop = paddingTop;
		}

		this.visibleLength = this.calcVisibleLength();

		const visibleIndexBottom = this.visibleIndexTop + this.visibleLength - 1;
		this.paddingBottom = this.getItemRangeHeight(visibleIndexBottom + 1, this.length - 1);

		this.visibleIndicesCalculated = true;
		this.handleChange();
	}

	// returns the number of visible items based on scrollTop, paddingTop, item
	// heights, and the total number of items
	private calcVisibleLength(): number {
		// hiddenHeightTop is the amount of the top most visible item that is
		// clipped out of view
		let hiddenHeightTop = this.scrollTop - this.paddingTop;
		let visibleLength = 0;
		let visibleHeight = hiddenHeightTop * -1;
		for (let i = this.visibleIndexTop; i < this.length; i++) {
			if (visibleHeight < this.viewportHeight) {
				visibleHeight = visibleHeight + this.getItemHeight(i);
				visibleLength++;
			} else {
				break;
			}
		}
		return visibleLength;
	}

	// sets viewportHeight and re-calculates visibleIndexTop/visibleLength and padding
	public updateViewportHeight(height: number): void {
		if (height === this.viewportHeight) return;
		this.viewportHeight = height;

		const prevVisibleLength = this.visibleLength;
		this.visibleLength = this.calcVisibleLength();
		const prevVisibleIndexBottom = this.visibleIndexTop + prevVisibleLength - 1;
		const visibleIndexBottom = this.visibleIndexTop + this.visibleLength - 1;

		this.paddingBottom = this.calcPaddingBottom({ visibleIndexBottom, prevVisibleIndexBottom });

		this.handleChange();
	}

	// sets length and re-calculates visibleIndexTop/visibleLength and padding,
	// assumes items were either added or removed from the end
	public updateLength(length: number): void {
		if (length === this.length) return;
		const prevLength = this.length;
		this.length = length;

		// re-calculate totalHeight
		const totalHeightDelta = (length - prevLength) * this.defaultHeight;
		this.totalHeight = this.totalHeight + totalHeightDelta;

		if (length > prevLength) {
			// more items have been added
			const prevVisibleLength = this.visibleLength;
			this.visibleLength = this.calcVisibleLength();
			const nNewVisible = this.visibleLength - prevVisibleLength;
			const heightDelta = this.getItemRangeHeight(prevLength + nNewVisible, length - 1);
			this.paddingBottom = this.paddingBottom + heightDelta;
		} else {
			// some items have been removed
			// TODO: calculate without iterating through all the items
			this.calculateVisibleIndices();
			return;
		}

		this.handleChange();
	}

	// sets scrollTop and re-calculates visibleIndexTop/visibleLength and padding
	public updateScrollPosition(scrollTop: number): void {
		const prevScrollTop = this.scrollTop;
		this.scrollTop = scrollTop;
		if (!this.visibleIndicesCalculated) return this.calculateVisibleIndices();

		const prevVisibleIndexTop = this.visibleIndexTop;
		const prevVisibleLength = this.visibleLength;
		const scrollTopDelta = scrollTop - prevScrollTop;

		if (scrollTopDelta === 0) {
			// no change
			return;
		}

		if (scrollTopDelta < 0) {
			// scrolled up
			let visibleIndexTop = this.visibleIndexTop;
			let paddingTop = this.paddingTop;
			for (let i = visibleIndexTop - 1; i >= 0; i--) {
				const height = this.getItemHeight(i);
				if (paddingTop > scrollTop) {
					paddingTop = paddingTop - height;
					visibleIndexTop--;
				} else {
					break;
				}
			}
			this.visibleIndexTop = visibleIndexTop;
			this.paddingTop = paddingTop;
		} else {
			// scrolled down
			let visibleIndexTop = this.visibleIndexTop;
			let paddingTop = this.paddingTop;
			for (let i = visibleIndexTop; i < this.length; i++) {
				const height = this.getItemHeight(i);
				if (paddingTop + height <= scrollTop) {
					paddingTop = paddingTop + height;
					visibleIndexTop++;
				} else {
					break;
				}
			}
			this.visibleIndexTop = visibleIndexTop;
			this.paddingTop = paddingTop;
		}

		this.visibleLength = this.calcVisibleLength();

		const prevVisibleIndexBottom = prevVisibleIndexTop + prevVisibleLength - 1;
		const visibleIndexBottom = this.visibleIndexTop + this.visibleLength - 1;
		this.paddingBottom = this.calcPaddingBottom({ visibleIndexBottom, prevVisibleIndexBottom });

		this.handleChange();
	}

	// returns what paddingBottom should be given changes in visible indices
	private calcPaddingBottom({
		visibleIndexBottom,
		prevVisibleIndexBottom
	}: {
		visibleIndexBottom: number;
		prevVisibleIndexBottom: number;
	}) {
		let paddingBottom = this.paddingBottom;
		if (visibleIndexBottom === this.length - 1) {
			// last item in the list, so there's never any paddingBottom left
			// return 0 to correct for any errors in adjustment made along the way
			paddingBottom = 0;
		} else if (visibleIndexBottom < prevVisibleIndexBottom) {
			// scrolled up
			const heightDelta = this.getItemRangeHeight(visibleIndexBottom + 1, prevVisibleIndexBottom);
			paddingBottom = paddingBottom + heightDelta;
		} else if (visibleIndexBottom > prevVisibleIndexBottom) {
			// scrolled down
			const heightDelta = this.getItemRangeHeight(prevVisibleIndexBottom, visibleIndexBottom - 1);
			paddingBottom = Math.max(0, paddingBottom - heightDelta);
		}

		const nItemsScrollBottom = this.length - visibleIndexBottom - 1;
		const minPaddingBottom = nItemsScrollBottom * (this.totalHeight / this.length);
		if (paddingBottom < minPaddingBottom) {
			paddingBottom = minPaddingBottom;
		}

		return paddingBottom;
	}

	// sets item height and re-calculates vidibleIndexTop/visibleLength and padding
	public updateHeightAtIndex(index: number, height: number): void {
		const prevHeight = this.getItemHeight(index);
		const prevVisibleIndexTop = this.visibleIndexTop;
		const prevVisibleLength = this.visibleLength;
		const prevVisibleIndexBottom = prevVisibleIndexTop + prevVisibleLength - 1;
		this.heights.set(index, height);

		// re-calculate totalHeight
		this.totalHeight = this.totalHeight - prevHeight + height;

		if (index > prevVisibleIndexBottom) {
			// item is part of padding bottom
			this.paddingBottom = this.paddingBottom - prevHeight + height;

			// nothing more to do
			this.handleChange();
			return;
		}

		if (index < this.visibleIndexTop) {
			// item is part of padding top
			this.paddingTop = this.paddingTop - prevHeight + height;
			let scrollTop = this.scrollTop;
			while (this.paddingTop > scrollTop) {
				scrollTop++;
			}
			this.scrollTop = scrollTop;
		} else {
			// item is in view
		}
		this.visibleLength = this.calcVisibleLength();

		const visibleIndexBottom = this.visibleIndexTop + this.visibleLength - 1;
		this.paddingBottom = this.calcPaddingBottom({ visibleIndexBottom, prevVisibleIndexBottom });

		this.handleChange();
	}

	private getItemHeight(index: number): number {
		if (index > this.length - 1) {
			// index is out of range
			return 0;
		}
		const height = this.heights.get(index);
		if (height === undefined) {
			return this.defaultHeight;
		}
		return height;
	}

	private getItemRangeHeight(startIndex: number, endIndex: number): number {
		let sum = 0;
		for (let i = startIndex; i <= endIndex; i++) {
			sum = sum + this.getItemHeight(i);
		}
		return sum;
	}

	private _handleChange() {
		this.subscribers.forEach((cb: CallbackFunction) => {
			cb(this);
		});
	}
}
