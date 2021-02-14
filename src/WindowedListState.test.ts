import State from './WindowedListState';

describe('calculateVisibleIndices', () => {
	it('selects items within viewport to display', () => {
		const state = new State();
		state.length = 1000;
		state.viewportHeight = 400;
		state.defaultHeight = 100;

		state.calculateVisibleIndices();
		expect(state.visibleIndexTop).toEqual(0);
		expect(state.visibleLength).toEqual(4);
	});

	it('sets padding for top and bottom equal to height of items out of range', () => {
		const state = new State();
		state.length = 1000;
		state.viewportHeight = 400;
		state.defaultHeight = 100;
		state.scrollTop = 120;

		const nHiddenTop = 1;
		const nVisible = 5;
		const nHiddenBottom = state.length - nHiddenTop - nVisible;

		state.calculateVisibleIndices();
		expect(state.visibleIndexTop).toEqual(nHiddenTop);
		expect(state.visibleLength).toEqual(nVisible);
		expect(state.paddingTop).toEqual(nHiddenTop * state.defaultHeight);
		expect(state.paddingBottom).toEqual(nHiddenBottom * state.defaultHeight);
	});
});

type MutationFn = (state: State) => void;

function mutateAll(instances: State[], mutateFn: MutationFn) {
	instances.forEach((state) => {
		mutateFn(state);
	});
}

// testMutationSeries asserts that running each of the given series of mutations has
// the same end result as running calculateVisibleIndices
function testMutationSeries(...mutations: MutationFn[]) {
	function stateToJSON(state: State): string {
		return JSON.stringify(
			{
				paddingTop: state.paddingTop,
				visibleIndexTop: state.visibleIndexTop,
				visibleLength: state.visibleLength,
				paddingBottom: state.paddingBottom
			},
			null,
			2
		);
	}

	const state = new State();
	const state2 = new State();
	mutations.forEach((m, i) => {
		mutateAll([state, state2], m);
		state2.calculateVisibleIndices();

		try {
			expect(state.visibleIndexTop).toEqual(state2.visibleIndexTop);
			expect(state.visibleLength).toEqual(state2.visibleLength);
			expect(state.paddingTop).toEqual(state2.paddingTop);
			expect(state.paddingBottom).toEqual(state2.paddingBottom);
		} catch (e) {
			const context = `[${i}]: ${m.toString()}\nexpected(${stateToJSON(state2)})\ngot(${stateToJSON(state)})`;
			e.message = `${context}\n${e.message}`;
			throw e;
		}
	});
}

// addContext appends the given string after wrapping in <context: ${string}>
// to the output of Function.toString for the given function. This is useful
// for debugging dynamically generated mutation functions passed to
// testMutationSeries
function addContext<T extends Function>(fn: T, context: string): T {
	const toString = fn.toString.bind(fn);
	fn.toString = function(): string {
		return `${toString()} <context: ${context}>`;
	};
	return fn;
}

describe('updateViewportHeight', () => {
	it('responds to a larger viewport', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateViewportHeight(500),
			(state) => state.updateViewportHeight(550),
			(state) => state.updateViewportHeight(560),
			(state) => state.updateViewportHeight(561),
			(state) => state.updateViewportHeight(562),
			(state) => state.updateViewportHeight(563)
		);
	});

	it('responds to a smaller viewport', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateViewportHeight(300),
			(state) => state.updateViewportHeight(250),
			(state) => state.updateViewportHeight(240),
			(state) => state.updateViewportHeight(539),
			(state) => state.updateViewportHeight(538),
			(state) => state.updateViewportHeight(537)
		);
	});

	it('responds to the same size of viewport', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateViewportHeight(400)
		);
	});
});

describe('updateLength', () => {
	it('responds to fewer items', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateLength(500),
			(state) => state.updateLength(400),
			(state) => state.updateLength(400),
			(state) => state.updateLength(399),
			(state) => state.updateLength(398),
			(state) => state.updateLength(397),
			(state) => state.updateLength(395),
			(state) => state.updateLength(394),
			(state) => state.updateLength(100),
			(state) => state.updateLength(50),
			(state) => state.updateLength(10),
			(state) => state.updateLength(5),
			(state) => state.updateLength(3),
			(state) => state.updateLength(1),
			(state) => state.updateLength(0)
		);
	});

	it('responds to more items', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateLength(2),
			(state) => state.updateLength(3),
			(state) => state.updateLength(4),
			(state) => state.updateLength(5),
			(state) => state.updateLength(10),
			(state) => state.updateLength(20),
			(state) => state.updateLength(30),
			(state) => state.updateLength(40),
			(state) => state.updateLength(50),
			(state) => state.updateLength(100),
			(state) => state.updateLength(200),
			(state) => state.updateLength(300),
			(state) => state.updateLength(400),
			(state) => state.updateLength(500),
			(state) => state.updateLength(601),
			(state) => state.updateLength(602),
			(state) => state.updateLength(603),
			(state) => state.updateLength(604),
			(state) => state.updateLength(605)
		);
	});

	it('responds to the same number of items', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateLength(1000)
		);
	});
});

describe('updateScrollPosition', () => {
	it('responds to a change in scroll position', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateScrollPosition(0),
			(state) => state.updateScrollPosition(120),
			(state) => state.updateScrollPosition(100),
			(state) => state.updateScrollPosition(90)
		);
	});

	it('responds to small incremental changes in scroll position', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateScrollPosition(0),
			(state) => state.updateScrollPosition(30),
			(state) => state.updateScrollPosition(60),
			(state) => state.updateScrollPosition(90),
			(state) => state.updateScrollPosition(100),
			(state) => state.updateScrollPosition(110),
			(state) => state.updateScrollPosition(99)
		);
	});

	it('sets padding for top and bottom equal to height of items out of range', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateScrollPosition(220),
			(state) => state.updateScrollPosition(200),
			(state) => state.updateScrollPosition(100),
			(state) => state.updateScrollPosition(10),
			(state) => state.updateScrollPosition(0)
		);
	});

	it('handles scrolling from top to bottom and back', () => {
		const len = 10;
		const itemHeight = 10;
		const totalHeight = len * itemHeight;
		let mutations = [] as MutationFn[];
		for (let i = 0; i <= totalHeight; i++) {
			mutations.push(
				addContext((state) => {
					state.updateScrollPosition(i);
				}, `i = ${i} / ${totalHeight}, direction = down`)
			);
		}
		for (let i = totalHeight; i >= 0; i--) {
			if (i === 190) {
				console.log('foo');
			}
			mutations.push(
				addContext((state) => {
					state.updateScrollPosition(i);
				}, `i = ${i} / ${totalHeight}, direction = up`)
			);
		}
		testMutationSeries((state) => {
			// setup
			state.length = len;
			state.viewportHeight = 50;
			state.defaultHeight = itemHeight;
			state.calculateVisibleIndices();
		}, ...mutations);
	});
});

describe('updateHeightAtIndex', () => {
	it('responds to a change in item heights', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 1000;
				state.viewportHeight = 400;
				state.defaultHeight = 100;
				state.calculateVisibleIndices();
			},
			(state) => state.updateHeightAtIndex(1, 250),
			(state) => state.updateHeightAtIndex(0, 250),
			(state) => state.updateHeightAtIndex(1, 100),
			(state) => state.updateHeightAtIndex(0, 100)
		);
	});

	it('responds to all items changing in height from top to bottom', () => {
		const len = 10;
		let mutations = [] as MutationFn[];
		for (let i = 0; i < len; i++) {
			mutations.push(
				addContext((state) => {
					state.updateHeightAtIndex(i, 25);
				}, `i = ${i}`)
			);
		}
		testMutationSeries((state) => {
			// setup
			state.length = len;
			state.viewportHeight = 50;
			state.defaultHeight = 10;
			state.scrollTop = 20;
			state.calculateVisibleIndices();
		}, ...mutations);
	});

	it('responds to all items changing in height from bottom to top', () => {
		const len = 10;
		let mutations = [] as MutationFn[];
		for (let i = len - 1; i >= 0; i--) {
			mutations.push(
				addContext((state) => {
					state.updateHeightAtIndex(i, 25);
				}, `i = ${i}`)
			);
		}
		testMutationSeries((state) => {
			// setup
			state.length = len;
			state.viewportHeight = 50;
			state.defaultHeight = 10;
			state.scrollTop = 20;
			state.calculateVisibleIndices();
		}, ...mutations);
	});

	it('padding reflects actual item heights', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 10;
				state.viewportHeight = 50;
				state.defaultHeight = 10;
				state.scrollTop = 20;
				state.calculateVisibleIndices();

				// visibleIndexTop: 2
				// visibleLength: 5
				// paddingTop: 20
				// paddingBottom: 30
				// scrollTop: 20
			},
			(state) => {
				// push an item into view
				state.updateHeightAtIndex(0, 15);

				// paddingTop: 15
				// visibleIndexTop: 1
				// visibleLength: 6
			},
			(state) => {
				// push the other item into view
				state.updateHeightAtIndex(0, 25);

				// paddingTop: 0
				// visibleIndexTop: 0
				// visibleLength: 6
			},
			(state) => {
				// grow the size of paddingBottom
				state.updateHeightAtIndex(6, 20);
				// paddingBottom: 50
			}
		);
	});

	it('handles resizing items in the paddingTop', () => {
		testMutationSeries(
			(state) => {
				// setup
				state.length = 30;
				state.viewportHeight = 100;
				state.defaultHeight = 10;
				state.scrollTop = 100;
				state.calculateVisibleIndices();
			},
			(state) => {
				state.updateHeightAtIndex(0, 20);
			}
		);
	});

	// TODO: add more rigerous testing
	// updateHeightAtIndex has a few bugs still, which are currently made up for
	// by forcing paddingBottom=0 when at the end of the list
});
