# Independent character timing

Scene tracks and rig parameters can already move at different times. A character’s `keys()` layers need extra care because a key that changes an elbow may also supply shoulder, hand and inverse-kinematics (IK) blend values to complete the limb pose. Use a channel mask when separate layers must control different joints.

Pass `channels:[...]` to a `keys()` call when that layer should contribute only selected numeric properties. This list is called a mask because it filters the layer’s output without creating another solver or clock. After filtering, the shared pose solve still combines forward kinematics (FK), which computes positions from joint angles, and inverse kinematics (IK), which finds angles for target positions. Omit the list to let the key layer contribute its complete pose.

```js
// Shoulder and elbow arrive independently on the same arm.
figure.keys([
  {at: 0, pose: {'armF.mix': 0}},
  {at: 1, duration: 1, ease: 'linear', pose: {'armF.upper': .8}},
], {channels: ['armF.upper', 'armF.mix']});

figure.keys([
  {at: .2, duration: 0, pose: {'armF.mix': 0}},
  {at: 2, duration: 1.8, ease: 'linear', pose: {'armF.lower': -.5}},
], {channels: ['armF.lower']});
```

In the example, the first layer selects the upper arm angle and its blend control. Setting that blend to zero makes the arm use joint angles rather than an IK hand target. The second layer contributes only the lower joint angle, so the shoulder and elbow can arrive at different times.

The upper angle is measured relative to the body, while the lower angle is measured relative to the upper bone. Use the corresponding `armF` or `armB` properties to control each arm independently. The shared solve still assembles one complete pose, which means these joints follow body movement instead of becoming detached from it.

A channel mask can also let the body move without replacing an earlier hand contact. The next example keeps the hand target from the first layer and takes only body rotation from the second.

```js
figure.keys([{at: 0, pose: {
  effectors: {handF: {target: [25, -120], mix: 1}},
}}]);
figure.keys([
  {at: .2, duration: 0, pose: {}},
  {at: 1, duration: .8, ease: 'linear', pose: {lean: .2}},
], {channels: ['body.r']});
```

List the numeric property names actually produced by the key plan. For example, `body.r` names body rotation directly, while `lean` is a higher-level pose instruction and cannot be selected as a numeric output. The mask does not accept nested pose objects or part names.

Supply 1–256 distinct names, each no longer than 128 characters, that exist on the character and appear in this plan’s output. Empty array slots, getters, duplicate names and unknown or unproduced properties are rejected before the layer is installed. The names are copied when you author the layer, so changing the caller’s array afterward cannot change what it controls.

A mask filters the sampled result rather than changing how each key plan is prepared. Every plan begins from the character’s declared rest state, not another layer’s current result. Supply an explicit starting key when that distinction affects the motion.

Choose all properties needed to control the intended movement. Selecting a joint angle without the FK/IK blend may leave inverse kinematics in charge. Selecting a hand or foot coordinate without the properties that activate its target can also have no visible effect. For an ordinary contact, use a complete nested effector pose without a mask, or explicitly select every required property.

The layer’s `weight`, `fadeIn`, `fadeOut` and `until` settings blend the selected values as usual. If later layers select the same property, their values take precedence according to the normal blend order. Facing changes and turnarounds are timed events rather than numeric pose values, so a channel mask does not filter them.

A still-style hold continues to suppress idle and secondary movement for the whole character. Selecting only a few properties does not make that suppression specific to each selected joint. Actions and reach limits also remain in force, so masking cannot make a hand or foot reach a physically impossible target.

The regression tests time the upper and lower joints independently, move separate arms, and move the body while keeping one hand planted. They also check weights, fades, exact backward seeks, the behavior without a mask and invalid inputs that must leave the installed layers unchanged.