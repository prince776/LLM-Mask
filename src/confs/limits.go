package confs

import "context"

func MaxRPSPerUser(ctx context.Context) int {
	return 100
}

func MaxRPSPerIp(ctx context.Context) int {
	return 10000
}
