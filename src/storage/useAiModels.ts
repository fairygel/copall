import { useQuery } from '@tanstack/react-query';
import { getAvailableModels } from '../service/ChatService';

export function useAiModels() {
  return useQuery({
    queryKey: ['ai-models-list'],
    queryFn: getAvailableModels,
  });
}