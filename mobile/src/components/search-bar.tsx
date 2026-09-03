import { StyleSheet, TextInput, View } from 'react-native';

import { SearchIcon } from '@/components/icons';
import { Colors, Radius } from '@/constants/theme';

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.wrapper}>
      <SearchIcon size={18} color={Colors.neutral600} strokeWidth={2.75} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral600}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    padding: 0,
    fontFamily: 'Figtree_400Regular',
    fontSize: 15,
    color: Colors.text,
  },
});
