---
layout: post
title: "spring statemachine"
date: 2024-07-07 22:05:00 +0800
description: "在 ReactiveStateMachineExecutor 类中，triggerSink 是一个 Sinks.Many 类型的对象，用于管理状态机触发器的事件流。…"
tags: [spring, 状态机]
original_url: https://www.cnblogs.com/xushengbin/p/18289002
---
进行状态转化的逻辑：

org.springframework.statemachine.support.ReactiveStateMachineExecutor#queueEvent

```text
Flux<Message<E>> messages = Flux.merge(message, Flux.fromIterable(deferList));

		MonoSinkStateMachineExecutorCallback triggerCallback = new MonoSinkStateMachineExecutorCallback();
		Mono<Void> triggerCallbackSink = Mono.create(triggerCallback);

		return messages
			.flatMap(m -> handleEvent(m, callback, triggerCallback))
			.flatMap(tqi -> Mono.fromRunnable(() -> {
					triggerSink.emitNext(tqi, EmitFailureHandler.FAIL_FAST);
				})
				.retryWhen(Retry.fixedDelay(10, Duration.ofMillis(10))))
			.then()
			.and(triggerCallbackSink);
```

在 ReactiveStateMachineExecutor 类中，triggerSink 是一个 `Sinks.Many<TriggerQueueItem>` 类型的对象，用于管理状态机触发器的事件流。当调用 triggerSink.emitNext 方法时，它会向这个事件流中发送一个 TriggerQueueItem 对象。这个操作本质上是在发布一个事件，表示有一个新的触发器项需要被处理。

handleTrigger 方法是设计来处理这些触发器项的。它通过订阅 triggerSink 的事件流来实现这一点。  

在 ReactiveStateMachineExecutor 类的 onInit 方法中，你会看到如下代码：

```text
triggerSink = Sinks.many().multicast().onBackpressureBuffer(Queues.SMALL_BUFFER_SIZE, false);
triggerFlux = triggerSink.asFlux().flatMap(trigger -> handleTrigger(trigger), 1);
```

这段代码首先初始化 triggerSink，然后创建一个 Flux（名为 triggerFlux），这个 Flux 通过调用 flatMap 方法来处理 triggerSink 中的每个 TriggerQueueItem。flatMap 方法的参数是 handleTrigger 方法的引用，这意味着每当 triggerSink 发出一个新的 TriggerQueueItem 时，handleTrigger 方法都会被调用来处理这个项。  

因此，当你调用 triggerSink.emitNext 发送一个 TriggerQueueItem 时，这个项会被添加到 triggerSink 的事件流中，然后 handleTrigger 方法会被自动调用来处理这个项，因为它已经订阅了这个事件流并设置为处理流中的每个项。

handleTrigger方法负责实际的状态转换逻辑，包括决定是否进行状态转换以及如何进行状态转换。

- 处理事件(handleEvent): 这个方法接收一个事件，并根据当前状态和事件类型决定是否需要进行状态转换。如果需要，它会生成一个表示该转换的TriggerQueueItem对象。
- 处理触发器(handleTrigger): 当TriggerQueueItem被triggerSink.emitNext方法发出后，它会被handleTrigger方法处理。这个方法检查触发器和当前状态，然后执行相应的状态转换逻辑。这可能包括调用StateMachineExecutorTransit的transit方法，该方法实现了具体的状态转换逻辑。

handleTrigger() 调用 handleTriggerTrans()， 调用org.springframework.statemachine.support.StateMachineExecutor.StateMachineExecutorTransit#transit ， 执行相应的状态转换逻辑。
