import React from 'react';
import './App.css';

import { default as ScrollDemo, Item } from './ScrollDemo';

function generateItems(n: number): Item[] {
	let items = [] as Item[];
	for (let i = 0; i < n; i++) {
		items.push({
			height: Math.max(50, Math.floor((Math.random() * 1000) % 400))
		});
	}
	return items;
}

function App() {
	const items = generateItems(10_000);
	return <ScrollDemo items={items} />;
}

export default App;
