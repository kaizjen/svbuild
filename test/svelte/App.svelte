<script>
	import Counter from "./components/Counter.svelte";
	import { TextBox } from "fluent-svelte";
	let name = 'world';
</script>

{#if name}
	<h1> Heaveno and badbye, {name} </h1>
{:else}
	<h1>Hello, stranger</h1>
{/if}

<TextBox placeholder="enter ur name" type="text" bind:value={name} />
<br>
<br>
<Counter></Counter>