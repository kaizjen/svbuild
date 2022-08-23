<script lang="ts">
	import Counter from "./components/Counter.svelte";
	import { TextBox } from "fluent-svelte";
	import { setContext } from "svelte";

	type Name = {
		value: string
	}
	let name: Name = { value: 'world' };

	setContext('msg', 'Hi')
</script>

{#if name.value}
	<h1> Hi, {name.value} </h1>
{:else}
	<h1> Hello, stranger </h1>
{/if}

<TextBox placeholder="enter ur name" type="text" bind:value={name} />
<br>
<br>
<Counter></Counter>