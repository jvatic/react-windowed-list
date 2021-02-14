import * as React from 'react';

import WindowedListState from './WindowedListState';

function findScrollParent(node: HTMLElement | null): HTMLElement | Window {
	while (node) {
		switch (window.getComputedStyle(node).overflowY) {
			case 'auto':
				return node;
			case 'scroll':
				return node;
			default:
				node = node.parentElement;
		}
	}
	return window;
}

function isWindow<T>(item: T | Window): item is Window {
	return item === window;
}

function getScrollContainerHeight(scrollContainer: HTMLElement | Window): number {
	if (isWindow(scrollContainer)) {
		return scrollContainer.innerHeight;
	} else {
		return scrollContainer.offsetHeight;
	}
}

function getOffsetTop(node: HTMLElement): number {
	return node.getBoundingClientRect().top;
}

interface ChildrenProps {
	onItemRender: (index: number, node: HTMLElement | null) => void;
}

interface Props {
	state: WindowedListState;
	thresholdTop: number; // number of pixels to keep rendered beyond the top of viewport
	thresholdBottom: number; // number of pixels to keep rendered beyond the bottom of viewport
	children: (startIndex: number, length: number, props: ChildrenProps) => React.ReactNode;
}

interface ItemDimensions {
	top: number;
	height: number;
}

export enum ActionType {
	SET_WINDOW = 'SET_WINDOW'
}

interface SetWindowAction {
	type: ActionType.SET_WINDOW;
	startIndex: number;
	length: number;
}

export type Action = SetWindowAction;

interface State {
	startIndex: number;
	length: number;
}

function getIntialState(listState: WindowedListState): State {
	return {
		startIndex: listState.visibleIndexTop,
		length: listState.visibleLength
	};
}

function reducer(prevState: State, actions: Action | Action[]): State {
	if (!Array.isArray(actions)) {
		actions = [actions];
	}

	const nextState = actions.reduce((prevState: State, action: Action) => {
		const nextState = Object.assign({}, prevState);
		switch (action.type) {
			case ActionType.SET_WINDOW:
				nextState.startIndex = action.startIndex;
				nextState.length = action.length;
				return nextState;

			default:
				return prevState;
		}
	}, prevState);

	return nextState;
}

export default function WindowedList({ state, thresholdTop, thresholdBottom, children }: Props) {
	const itemDimensions = React.useMemo(() => new Map<number, ItemDimensions | null>(), []);
	const scrollParentRef = React.useMemo<{ current: HTMLElement | Window | null }>(() => ({ current: null }), []);
	const resizeObserverRef = React.useMemo(() => ({ current: null as ResizeObserver | null }), []);
	const offsetTopRef = React.useMemo(() => ({ current: 0 }), []);

	const [{ startIndex, length }, dispatch] = React.useReducer(reducer, getIntialState(state));

	const willUnmountFns = React.useMemo<Array<() => void>>(() => [], []);
	React.useEffect(
		() => {
			return () => {
				willUnmountFns.forEach((fn) => fn());
			};
		},
		[willUnmountFns]
	);

	const calcItemDimensions = React.useCallback((node: HTMLElement): ItemDimensions | null => {
		const rect = node.getClientRects()[0];
		if (!rect) return null;
		const style = window.getComputedStyle(node);
		const margin =
			parseFloat(style.getPropertyValue('margin-top')) + parseFloat(style.getPropertyValue('margin-bottom'));
		const dimensions = { top: rect.top, height: rect.height + margin };
		return dimensions;
	}, []);

	const getScrollTop = React.useCallback(
		() => {
			if (scrollParentRef.current === null) {
				return 0;
			}
			let scrollTop = 0;
			if (isWindow(scrollParentRef.current)) {
				scrollTop = window.scrollY;
			} else {
				scrollTop = scrollParentRef.current.scrollTop;
			}
			const offsetTop = offsetTopRef.current;
			return Math.max(0, scrollTop - offsetTop);
		},
		[scrollParentRef, offsetTopRef]
	);

	const handleScroll = React.useCallback(
		() => {
			const scrollTop = Math.max(0, getScrollTop() - thresholdTop);
			state.updateScrollPosition(scrollTop);
		},
		[getScrollTop, state, thresholdTop]
	);

	const handleScrollParentResize = React.useCallback(
		() => {
			const scrollParentNode = scrollParentRef.current;
			if (!scrollParentNode) return;
			const viewportHeight = getScrollContainerHeight(scrollParentNode);
			state.updateViewportHeight(viewportHeight + thresholdBottom);
		},
		[state, scrollParentRef, thresholdBottom]
	);

	const onItemRender = React.useCallback(
		(index: number, node: HTMLElement | null) => {
			const cleanupFns = [] as (() => void)[];
			const cleanup = () => cleanupFns.forEach((fn) => fn());
			if (!node) {
				return cleanup;
			}

			// calculate item dimensions
			const dimensions = calcItemDimensions(node);
			itemDimensions.set(index, dimensions);
			if (dimensions) {
				state.updateHeightAtIndex(index, dimensions.height);
			}

			if (scrollParentRef.current === null) {
				const scrollParentNode = findScrollParent(node.parentElement);
				scrollParentRef.current = scrollParentNode;
				const eventOpts = { passive: true, capture: false };
				scrollParentNode.addEventListener('scroll', handleScroll, eventOpts);
				cleanupFns.push(() => {
					scrollParentNode.removeEventListener('scroll', handleScroll, eventOpts);
				});

				// handle scroll parent resizing
				if (isWindow(scrollParentNode)) {
					scrollParentNode.addEventListener('resize', handleScrollParentResize, eventOpts);
					cleanupFns.push(() => {
						scrollParentNode.removeEventListener('resize', handleScrollParentResize, eventOpts);
					});
				} else {
					const resizeObserver = new window.ResizeObserver(handleScrollParentResize);
					resizeObserver.observe(scrollParentNode);
					resizeObserverRef.current = resizeObserver;
					cleanupFns.push(() => resizeObserver.disconnect());
				}
				// set the viewport height
				handleScrollParentResize();
			}

			return cleanup;
		},
		[
			calcItemDimensions,
			handleScroll,
			itemDimensions,
			scrollParentRef,
			state,
			resizeObserverRef,
			handleScrollParentResize
		]
	);

	const paddingTopRef = React.useRef<HTMLElement>();
	const paddingBottomRef = React.useRef<HTMLElement>();

	React.useEffect(
		() => {
			return state.onChange((state: WindowedListState) => {
				const paddingTopNode = paddingTopRef.current;
				if (paddingTopNode) {
					paddingTopNode.style.height = state.paddingTop + 'px';
				}

				const paddingBottomNode = paddingBottomRef.current;
				if (paddingBottomNode) {
					paddingBottomNode.style.height = state.paddingBottom + 'px';
				}

				dispatch({ type: ActionType.SET_WINDOW, startIndex: state.visibleIndexTop, length: state.visibleLength });
			});
		},
		[state, dispatch]
	);

	// this will run once after the initial render
	React.useLayoutEffect(
		() => {
			const node = paddingTopRef.current;
			if (!node) return;
			offsetTopRef.current = getOffsetTop(node);
		},
		[paddingTopRef, offsetTopRef]
	);

	return (
		<>
			<div ref={paddingTopRef as any} style={{ height: state.paddingTop, fontSize: 0 }}>
				&nbsp;
			</div>

			{children(startIndex, length, { onItemRender })}

			<div ref={paddingBottomRef as any} style={{ height: state.paddingBottom, fontSize: 0 }}>
				&nbsp;
			</div>
		</>
	);
}

interface ItemProps extends ChildrenProps {
	index: number;
	children: (ref: React.MutableRefObject<HTMLElement | null>) => React.ReactNode;
}

export const WindowedListItem = ({ children, index, onItemRender }: ItemProps) => {
	const ref = React.useMemo<{ current: null | HTMLElement }>(() => ({ current: null }), []);
	React.useLayoutEffect(
		() => {
			onItemRender(index, ref.current);
		},
		[index, onItemRender, ref]
	);
	return <>{children(ref)}</>;
};
