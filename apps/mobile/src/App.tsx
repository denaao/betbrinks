import React from 'react';
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View style={{ padding: 50, backgroundColor: '#6B21A8', minHeight: 500 }}>
      <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>
        BetBrinks
      </Text>
      <Text style={{ color: 'white', fontSize: 18, marginTop: 10 }}>
        Se voce ve isso, o app funciona!
      </Text>
    </View>
  );
}
